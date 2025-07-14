import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_API,
});

export const getAIResponse = async (systemPrompt, userMessage) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4.1-nano-2025-04-14",
            store: false,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
        });
        return completion.choices[0].message.content;
    } catch (err) {
        console.error("Chat Completion Failed. ", err);
    }
};
