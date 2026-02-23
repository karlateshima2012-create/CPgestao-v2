
import { GoogleGenAI } from "@google/genai";
import { Contact } from "../types";

// Always use named parameter for initialization and obtain API key from environment variable
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateEmailDraft = async (contact: Contact, context: string): Promise<string> => {
  try {
    const prompt = `
      Você é um assistente de IA para um CRM.
      Escreva um email profissional e amigável para um cliente chamado ${contact.name}.
      
      Detalhes do Cliente:
      - Nome: ${contact.name}
      - Notas: ${contact.notes}
      - Último Contato: ${contact.lastContacted || 'Nunca'}
      
      Contexto/Objetivo do email: ${context}
      
      Mantenha-o conciso, com menos de 150 palavras. Não inclua linhas de assunto, apenas o corpo do email. O idioma deve ser Português do Brasil.
    `;

    // Updated prohibited model 'gemini-2.5-flash' to 'gemini-3-flash-preview'
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar o rascunho.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao gerar conteúdo. Tente novamente mais tarde.";
  }
};

export const suggestNextAction = async (notes: string): Promise<string> => {
  try {
    // Updated prohibited model 'gemini-2.5-flash' to 'gemini-3-flash-preview'
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Com base nestas notas de CRM, sugira um próximo passo único, curto e acionável (máx 10 palavras) em Português do Brasil: "${notes}"`
    });
    return response.text || "Acompanhar em breve.";
  } catch (e) {
    return "Revisar conta.";
  }
}
