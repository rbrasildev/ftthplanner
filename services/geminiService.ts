import { GoogleGenAI } from "@google/genai";
import { NetworkState } from "../types";

const GEMINI_API_KEY = process.env.API_KEY || '';

export const analyzeNetwork = async (network: NetworkState): Promise<string> => {
  if (!GEMINI_API_KEY) {
    return "API Key is missing. Please check your configuration.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    // Prepare a simplified summary for the AI to consume fewer tokens but get the gist
    const summary = {
      totalCTOs: network.ctos.length,
      totalCables: network.cables.length,
      ctoDetails: network.ctos.map(cto => ({
        name: cto.name,
        splitters: cto.splitters.map(s => s.type),
        connectedClients: cto.connections.length, // Rough approximation
        location: cto.coordinates
      })),
      cables: network.cables.map(c => ({
        type: c.fiberCount + " fibers",
        lengthCalc: "Approximate based on coord distance"
      }))
    };

    const prompt = `
      Act as a Senior Telecommunications Engineer. Analyze the following FTTH (Fiber to the Home) network topology data.
      
      Data: ${JSON.stringify(summary, null, 2)}

      Please provide:
      1. A brief summary of the network capacity.
      2. Potential bottlenecks or suggestions for optimization (e.g., splitter usage, cascade limits).
      3. A calculation estimate for the optical budget if we assume a standard loss of 0.35dB/km and 17dB for 1:32 splits (or relevant splitters used).
      4. Any safety or design recommendations.

      Format the output in clean Markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No analysis could be generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to connect to AI service. Please try again later.";
  }
};