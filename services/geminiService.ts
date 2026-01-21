
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GroundingSource, GeoLocation } from "../types";

// Helper to get AI instance.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Health Segment: Chatbot with Medical Context & Search Grounding
 */
export const getHealthAdvice = async (
  history: { role: string; text: string }[],
  currentMessage: string,
  isNurseMode: boolean = false
): Promise<{ text: string; sources: GroundingSource[]; isEscalated: boolean }> => {
  const ai = getAI();
  
  const escalationKeywords = ['bleeding', 'emergency', 'pain', 'suicide', 'severe', 'pregnant', 'miscarriage', 'lump', 'fever', 'blood', 'hurt', 'sick', 'hospital'];
  const shouldEscalate = isNurseMode || escalationKeywords.some(k => currentMessage.toLowerCase().includes(k));

  const kenyanLanguages = `Swahili, English, Kikuyu, Luhya, Luo, Kalenjin, Kamba, Kisii, Meru, Mijikenda, Somali, Turkana, Maasai, Taita, Embu, Pokot, Giriama, Samburu, Borana, Kiembu, Kigiriama, Kipokot, Kipsigis, Kimeru, Kisamburu, Kitaita, Kiteso, Kiturkana, Kuria, Mbeere, Njemps, Ogiek, Orma, Pokomo, Rendille, Sengwer, Suba, Taveta, Tharaka, Bajuni, Burji, Dasenach, El Molo, Galjeel, Galla, Gosha, Ilchamus, Konso, Sakuye, Waata.`;

  const baseInstruction = `Context: You are an AI assistant for "Dual Power Women Hub" in Kenya. Language Protocol: Support all Kenyan languages: ${kenyanLanguages}. Mirror user's language. Formatting: Plain text only.`;
  const nurseInstruction = `${baseInstruction} Role: Virtual Private Nurse. Task: Provide professional medical triage advice. Tone: Empathetic, calm, serious.`;
  const friendInstruction = `${baseInstruction} Role: Women's Wellness Assistant. Task: Answer general health/lifestyle questions. Tone: Friendly, sisterly.`;

  const systemInstruction = shouldEscalate ? nurseInstruction : friendInstruction;

  try {
    // Optimization: Use Flash for general chat to improve connection speed, only use Pro for severe medical escalation if needed.
    // However, user reported connection issues, so defaulting to Flash for reliability is safer.
    const primaryModel = 'gemini-3-flash-preview'; 
    
    const response = await ai.models.generateContent({
      model: primaryModel,
      contents: [
        ...history
            .filter(h => h.text && h.text.trim().length > 0) // Filter out empty messages
            .map(h => ({ role: h.role === 'nurse' ? 'model' : h.role, parts: [{ text: h.text }] })),
        { role: 'user', parts: [{ text: currentMessage }] }
      ],
      config: {
        systemInstruction: systemInstruction,
        tools: shouldEscalate ? [] : [{ googleSearch: {} }],
      }
    });

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
    console.warn("Health AI Error:", error);
    return { text: "Network connection weak. Please call 0112241760 for immediate help.", sources: [], isEscalated: true };
  }
};

/**
 * Wealth Segment: Analyze Asset Image for Auto-Fill
 */
export const analyzeAsset = async (base64Image: string): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // FAST MODEL
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
    return "{}";
  }
};

/**
 * SECURITY: Validate Asset Images vs Name
 * Checks if the 5+ images actually match the provided title.
 */
export const validateAssetImages = async (images: string[], title: string): Promise<{ valid: boolean; reason?: string }> => {
  const ai = getAI();
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
        model: 'gemini-3-flash-preview', // FAST MODEL
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });

    const result = JSON.parse(response.text || '{"valid": false, "reason": "AI Error"}');
    return result;
  } catch (e) {
      console.error("Asset Validation Error:", e);
      // Fallback: If AI fails due to connection, allow pending manual review
      return { valid: true, reason: "Manual Review Required (AI Offline)" };
  }
};

/**
 * SECURITY: Validate Kenyan ID (Front & Back)
 */
export const validateKenyanID = async (frontImage: string, backImage: string): Promise<{ valid: boolean; reason?: string }> => {
    const ai = getAI();
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
            model: 'gemini-3-flash-preview', // FAST MODEL (Significantly faster than Pro)
            contents: { parts: parts as any },
            config: { responseMimeType: 'application/json' }
        });

        const result = JSON.parse(response.text || '{"valid": false, "reason": "AI Error"}');
        return result;
    } catch (e) {
        console.error("ID Validation Error:", e);
        return { valid: false, reason: "Verification Service Unavailable. Please retry." };
    }
};

export const editAssetImage = async (base64Image: string, prompt: string): Promise<string | null> => {
  const ai = getAI();
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
  const ai = getAI();
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
  const ai = getAI();
  try {
    const win = window as any;
    if (win.aistudio && !await win.aistudio.hasSelectedApiKey()) throw new Error("API Key not selected");

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
    return videoUri ? `${videoUri}&key=${process.env.API_KEY}` : null;
  } catch (error) {
    return null;
  }
};
