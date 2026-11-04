import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

// Inicializa a instância do SDK oficial do Google Gemini
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Esquema de saída estrita (Structured Output) para garantir conformidade do JSON retornado
const documentExtractionSchema = {
  type: Type.OBJECT,
  properties: {
    loja: {
      type: Type.STRING,
      description: 'Nome da loja, fornecedor, serviço ou empresa emissora (ex: Apple, Amazon, Netflix, Magazine Luiza).'
    },
    valor: {
      type: Type.NUMBER,
      description: 'Valor total final da compra ou da mensalidade em reais como número decimal (ex: 149.90).'
    },
    data_compra: {
      type: Type.STRING,
      description: 'Data de emissão da nota, compra ou início da assinatura no formato ISO YYYY-MM-DD.'
    },
    meses_garantia: {
      type: Type.INTEGER,
      description: 'Prazo de validade ou garantia em meses. Se for assinatura mensal, coloque 1. Se anual, 12. Se nota com garantia padrão de 1 ano, 12. Se não houver menção, informe 0.'
    },
    tipo_documento: {
      type: Type.STRING,
      enum: ['garantia', 'assinatura', 'nota_fiscal'],
      description: 'Classificação semântica: "garantia", "assinatura" ou "nota_fiscal".'
    }
  },
  required: ['loja', 'valor', 'data_compra', 'meses_garantia', 'tipo_documento']
};

/**
 * Envia o arquivo (Buffer) para a API do Gemini com o esquema estruturado
 * @param {Buffer} fileBuffer Conteúdo binário da foto ou PDF
 * @param {string} mimeType Tipo MIME do arquivo (image/jpeg, image/png, application/pdf)
 */
export async function extractDocumentData(fileBuffer, mimeType) {
  if (!ai || !apiKey || apiKey === 'seu_gemini_api_key_aqui') {
    throw new Error('GEMINI_API_KEY não configurada no arquivo server/.env.');
  }

  const prompt = `
    Você é um assistente financeiro especialista em OCR e auditoria de comprovantes fiscais e assinaturas.
    Analise o documento anexo (foto de nota fiscal, cupom fiscal, recibo ou PDF de assinatura).
    Extraia as seguintes informações essenciais:
    1. Nome da loja ou fornecedor principal.
    2. Valor total monetário.
    3. Data da compra/emissão (converta para o formato YYYY-MM-DD).
    4. Prazo de garantia em meses (ou ciclo de renovação se for assinatura).
    5. Tipo de documento ("garantia", "assinatura" ou "nota_fiscal").

    Retorne apenas os dados estruturados conforme o esquema exigido.
  `;

  // Modelo Gemini 2.5 Flash: mais rápido e ideal para tarefas multimodais de OCR
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        inlineData: {
          mimeType,
          data: fileBuffer.toString('base64')
        }
      },
      prompt
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: documentExtractionSchema,
      temperature: 0.1 // Temperatura baixa para máxima fidelidade aos dados do comprovante
    }
  });

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('A API do Gemini retornou uma resposta vazia.');
  }

  return JSON.parse(rawText);
}
