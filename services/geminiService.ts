
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GroundingSource, GeoLocation } from "../types";
import { getSettings } from "./storageService";

// Hardcoded fallback key provided for deployment stability (Text/Vision only)
const FALLBACK_API_KEY = "AIzaSyCloJjKarKbYjvYoMw-uJl9hcKRDJqcNuw";
const VERIFICATION_TIMEOUT_MS = 60000; // 60 Seconds Failsafe

// Helper to safely get env var without crashing if process is undefined
const getEnvKey = () => {
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
            // @ts-ignore
            return import.meta.env.VITE_API_KEY;
        }
        // @ts-ignore
        return typeof process !== 'undefined' && process.env ? process.env.API_KEY : "";
    } catch (e) {
        return "";
    }
};

// Helper to get AI instance with dynamic key resolution and timeouts
const getAI = async () => {
  let dbKey = "";

  // 1. Try to get key from DB Settings (Admin Configured)
  try {
    const settingsPromise = getSettings();
    // Short timeout for settings fetch to prevent blocking
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    const settings = await Promise.race([settingsPromise, timeoutPromise]);
    
    if (settings && settings.geminiApiKey && settings.geminiApiKey.length > 10) {
       dbKey = settings.geminiApiKey;
    }
  } catch (e) {
    console.warn("Failed to fetch settings for API key, using fallback");
  }

  // 2. Resolve Final Key: DB > Env > Hardcoded Fallback
  const finalKey = dbKey || getEnvKey() || FALLBACK_API_KEY;
  const isFallback = finalKey === FALLBACK_API_KEY;
  
  if (!finalKey) console.error("CRITICAL: No Gemini API Key found!");

  return { 
      ai: new GoogleGenAI({ apiKey: finalKey }),
      key: finalKey,
      isFallback
  };
};

/**
 * SYSTEM: Diagnostics
 * Checks if the AI is reachable and what key level is being used.
 */
export const getSystemDiagnostics = async (): Promise<{ status: 'online'|'offline', latency: number, keyType: 'custom'|'fallback'|'env', model: string }> => {
    const start = Date.now();
    try {
        const { ai, key, isFallback } = await getAI();
        const envKey = getEnvKey();
        
        let keyType: 'custom'|'fallback'|'env' = 'fallback';
        if (isFallback) keyType = 'fallback';
        else if (key === envKey) keyType = 'env';
        else keyType = 'custom';

        // Ping the model with a tiny token request
        await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: 'ping' }] }
        });

        return {
            status: 'online',
            latency: Date.now() - start,
            keyType,
            model: 'gemini-3-flash-preview'
        };
    } catch (e) {
        console.error("Diagnostic Fail:", e);
        return {
            status: 'offline',
            latency: 0,
            keyType: 'fallback', // assumption on fail
            model: 'unknown'
        };
    }
};

/**
 * Health Segment: Chatbot with Medical Context & Search Grounding
 */
export const getHealthAdvice = async (
  history: { role: string; text: string }[],
  currentMessage: string,
  isNurseMode: boolean = false
): Promise<{ text: string; sources: GroundingSource[]; isEscalated: boolean }> => {
  const { ai } = await getAI();
  
  // Expanded keywords for stricter safety
  const escalationKeywords = [
      'bleeding', 'emergency', 'pain', 'suicide', 'severe', 'pregnant', 'miscarriage', 'lump', 'fever', 'blood', 
      'hurt', 'sick', 'hospital', 'dying', 'kill', 'abuse', 'rape', 'assault', 'danger', 'scared', 'afraid', 
      'chest', 'breath', 'faint', 'conscious', 'poison', 'overdose', 'burn', 'broken', 'stroke', 'attack',
      'help', 'urget'
  ];
  
  const shouldEscalate = isNurseMode || escalationKeywords.some(k => currentMessage.toLowerCase().includes(k));

  const kenyanLanguages = `Swahili, English, Kikuyu, Luhya, Luo, Kalenjin, Kamba, Kisii, Meru, Mijikenda, Somali, Turkana, Maasai, Taita, Embu, Pokot, Giriama, Samburu, Borana, Kiembu, Kigiriama, Kipokot, Kipsigis, Kimeru, Kisamburu, Kitaita, Kiteso, Kiturkana, Kuria, Mbeere, Njemps, Ogiek, Orma, Pokomo, Rendille, Sengwer, Suba, Taveta, Tharaka, Bajuni, Burji, Dasenach, El Molo, Galjeel, Galla, Gosha, Ilchamus, Konso, Sakuye, Waata.`;

  const baseInstruction = `Context: You are an AI assistant for "Dual Power Women Hub" in Kenya. Language Protocol: Support all Kenyan languages: ${kenyanLanguages}. Mirror user's language. Formatting: Plain text only.`;
  const nurseInstruction = `${baseInstruction} CRITICAL ROLE: Virtual Private Nurse. Task: Provide professional medical triage advice. 
  RULES:
  1. Acknowledge the severity immediately.
  2. advise on immediate first aid if applicable.
  3. Strongly recommend visiting a hospital or calling emergency services (999 or 112 in Kenya).
  4. Tone: Empathetic, calm, serious, professional.`;
  
  const friendInstruction = `${baseInstruction} Role: Women's Wellness Assistant. Task: Answer general health/lifestyle questions. Tone: Friendly, sisterly. If symptoms seem severe, suggest seeing a doctor.`;

  const systemInstruction = shouldEscalate ? nurseInstruction : friendInstruction;

  // Helper to try generation with fallback
  const generate = async (model: string) => {
      return await ai.models.generateContent({
        model: model,
        contents: [
          ...history
              .filter(h => h.text && h.text.trim().length > 0)
              .map(h => ({ role: h.role === 'nurse' ? 'model' : h.role, parts: [{ text: h.text }] })),
          { role: 'user', parts: [{ text: currentMessage }] }
        ],
        config: {
          systemInstruction: systemInstruction,
          tools: shouldEscalate ? [] : [{ googleSearch: {} }],
        }
      });
  };

  try {
    let response;
    try {
        // Try Primary Model
        response = await generate('gemini-3-flash-preview');
    } catch (primaryError) {
        console.warn("Primary Model Failed, trying fallback 'gemini-2.5-flash'", primaryError);
        // Fallback to older stable model
        response = await generate('gemini-2.5-flash');
    }

    const text = response.text || "I apologize, I could not process that request.";
    const sources: GroundingSource[] = [];
    if (!shouldEscalate) {
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
            chunks.forEach((chunk: any) => {
                if (chunk.web?.uri && chunk.web?.title) {
                    sources.push({ title: chunk.web.title, uri: chunk.web.uri });
                }
            });
        }
    }
    return { text, sources, isEscalated: shouldEscalate };

  } catch (error: any) {
    console.error("Health AI Critical Error:", error);
    if (shouldEscalate) {
        return { text: "I am having trouble connecting, but your situation sounds serious. Please go to the nearest hospital immediately or call 112.", sources: [], isEscalated: true };
    }
    return { text: "System is experiencing high traffic or key issues. Please try again in a moment.", sources: [], isEscalated: true };
  }
};

/**
 * Wealth Segment: Analyze Asset Image for Auto-Fill
 */
export const analyzeAsset = async (base64Image: string): Promise<string> => {
  const { ai } = await getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: `Analyze this item for a Kenyan rental marketplace. Return JSON { title, description, estimated_rate (int), category, condition }.` }
        ]
      },
      config: { responseMimeType: 'application/json' }
    });
    return response.text || "{}";
  } catch (error) {
    console.error("Analyze Asset Error", error);
    return "{}";
  }
};

/**
 * SECURITY: Validate Asset Images vs Name
 * Checks if the 5+ images actually match the provided title.
 * TIMEOUT: If >60s, pass to Admin Review (valid: true).
 */
export const validateAssetImages = async (images: string[], title: string): Promise<{ valid: boolean; reason?: string }> => {
  const { ai } = await getAI();
  
  const verifyPromise = (async () => {
    try {
        // We send up to 5 images for validation to save tokens/bandwidth
        const parts: any[] = images.slice(0, 5).map(img => ({
            inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] || img }
        }));
        
        parts.push({ 
            text: `SECURITY AUDIT: You are a strict marketplace moderator.
            Task: Verify if these images consistently represent a "${title}".
            Rules:
            1. If images are unrelated (e.g., a car and a shoe), REJECT.
            2. If images are low quality/blurry/black, REJECT.
            3. If images do not match the title "${title}", REJECT.
            
            Return JSON: { "valid": boolean, "reason": "string (short harsh reason if rejected)" }` 
        });

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: { parts },
            config: { responseMimeType: 'application/json' }
        });

        return JSON.parse(response.text || '{"valid": false, "reason": "AI Error"}');
      } catch (e) {
          console.error("Asset Validation Error:", e);
          // Fallback: If AI fails due to connection, allow pending manual review
          return { valid: true, reason: "Manual Review Required (AI Offline)" };
      }
  })();

  // 60 Second Timeout Failsafe - returns VALID (Pass Success) to wait for admin
  const timeoutPromise = new Promise<{ valid: boolean; reason?: string }>((resolve) => {
      setTimeout(() => resolve({ valid: true, reason: "AI Timeout - Passed for Manual Admin Review" }), VERIFICATION_TIMEOUT_MS);
  });

  return Promise.race([verifyPromise, timeoutPromise]);
};

/**
 * SECURITY: Validate Kenyan ID (Front & Back)
 * TIMEOUT: If >60s, pass to Admin Review (valid: true).
 */
export const validateKenyanID = async (frontImage: string, backImage: string): Promise<{ valid: boolean; reason?: string }> => {
    const { ai } = await getAI();
    
    const verifyPromise = (async () => {
        try {
            const parts = [
                { inlineData: { mimeType: 'image/jpeg', data: frontImage.split(',')[1] || frontImage } },
                { inlineData: { mimeType: 'image/jpeg', data: backImage.split(',')[1] || backImage } },
                { text: `SECURITY AUDIT: Verify Kenyan National ID.
                Image 1 must be FRONT. Image 2 must be BACK.
                
                Look for:
                - "REPUBLIC OF KENYA" text.
                - Coat of Arms.
                
                Strictly REJECT if:
                - Images are random objects, animals, or selfies.
                - Both images are the same.
                
                Return JSON: { "valid": boolean, "reason": "string (HARSH warning if fake)" }` }
            ];

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview', 
                contents: { parts: parts as any },
                config: { responseMimeType: 'application/json' }
            });

            return JSON.parse(response.text || '{"valid": false, "reason": "AI Error"}');
        } catch (e) {
            console.error("ID Validation Error:", e);
            // Default to manual review on error
            return { valid: true, reason: "Verification Service Unavailable. Pending Admin Review." };
        }
    })();

    const timeoutPromise = new Promise<{ valid: boolean; reason?: string }>((resolve) => {
        setTimeout(() => resolve({ valid: true, reason: "AI Timeout - Passed for Manual Admin Review" }), VERIFICATION_TIMEOUT_MS);
    });

    return Promise.race([verifyPromise, timeoutPromise]);
};

export const editAssetImage = async (base64Image: string, prompt: string): Promise<string | null> => {
  const { ai } = await getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Image } },
          { text: prompt },
        ],
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const findLocalSuppliers = async (query: string, location: GeoLocation): Promise<{text: string, chunks: any[]}> => {
  const { ai } = await getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find locations for: ${query}`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: { retrievalConfig: { latLng: { latitude: location.latitude, longitude: location.longitude } } }
      },
    });
    return {
      text: response.text || "No results found.",
      chunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    return { text: "Could not fetch location data.", chunks: [] };
  }
};

export const generateMarketingVideo = async (prompt: string, imageBytes?: string): Promise<string | null> => {
  const { ai, key, isFallback } = await getAI();
  try {
    const win = window as any;
    if ((isFallback || !key) && win.aistudio) {
        if (!await win.aistudio.hasSelectedApiKey()) {
             await win.aistudio.openSelectKey();
        }
    }

    let operation;
    if (imageBytes) {
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: { imageBytes: imageBytes, mimeType: 'image/png' },
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      });
    } else {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
          });
    }

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    return videoUri ? `${videoUri}&key=${key}` : null;
  } catch (error) {
    console.error("Video Generation Error", error);
    return null;
  }
};
