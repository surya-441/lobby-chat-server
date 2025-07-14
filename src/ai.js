import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_API,
});

export const testAI = async () => {
    const completion = openai.chat.completions.create({
        model: "gpt-4o-mini",
        store: true,
        messages: [{ role: "user", content: "write a haiku about ai" }],
    });

    completion.then((result) => console.log(result.choices[0].message));
};

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
