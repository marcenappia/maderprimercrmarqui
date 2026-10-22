import { createServerFn } from "@tanstack/react-start";
import { initialProspects } from "@/lib/prospects";

type Input = { prospectId: number; context: string };

export const generateApproach = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => {
    if (!Number.isInteger(input?.prospectId)) throw new Error("Escritório inválido");
    const context = String(input.context ?? "").trim();
    if (context.length < 3 || context.length > 1500) throw new Error("Contexto deve ter entre 3 e 1500 caracteres");
    return { prospectId: input.prospectId, context };
  })
  .handler(async ({ data }): Promise<{ message?: string; error?: string }> => {
    const p = initialProspects.find((x) => x.id === data.prospectId);
    if (!p) return { error: "Escritório não encontrado." };
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { error: "IA não configurada." };

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const { createLovableAiGatewayRunIdFetch } = await import("./run-id");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: createLovableAiGatewayRunIdFetch().fetch,
    });

    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions:
          "Você é Evaldo, da MadePrimer, marcenaria de móveis planejados e sob medida. Escreva UMA mensagem de abordagem para WhatsApp, em português do Brasil, tom profissional e cordial, até 90 palavras, sem emojis, sem markdown, sem assinatura extra além do nome. Personalize com o perfil do escritório e o contexto informado. Termine com uma pergunta simples convidando para conversa. Responda apenas com o texto da mensagem.",
        messages: [
          {
            role: "user",
            content: `Escritório: ${p.name}\nFoco/região: ${p.focus}\nFonte do contato: ${p.source}\nCanal: ${p.channel}\nPrioridade: ${p.priority}\n\nContexto do contato:\n${data.context}`,
          },
        ],
        maxRetries: 0,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const text = (await result.text).trim();
      if (!text) return { error: "A IA não retornou uma mensagem. Tente outro contexto." };
      return { message: text };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      console.error("AI generation failed", status, e);
      if (status === 429) return { error: "Muitas solicitações. Aguarde um instante e tente de novo." };
      if (status === 402) return { error: "Créditos de IA esgotados. Adicione créditos no workspace." };
      if (status === 403) return { error: "Acesso à IA bloqueado para este workspace." };
      return { error: "Não foi possível gerar a mensagem agora." };
    }
  });
