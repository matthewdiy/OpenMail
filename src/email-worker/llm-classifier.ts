import { ChatOpenAI } from "@langchain/openai";

export interface EmailClassificationResult {
	verification_code: string | null;
	summary: string | null;
	category: string | null;
}

function buildClassifier() {
	return new ChatOpenAI({
		model: "@cf/zai-org/glm-4.7-flash",
		topP: 0.05,
		apiKey: process.env.CLOUDFLARE_AI_API_TOKEN,
		configuration: {
			baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_AI_ACCOUNT_ID}/ai/v1`,
		},
	});
}

function buildPrompt(input: {
	categories: string;
	subject: string | null;
	from: string;
	body: string;
}) {
	return `Analyze the following email.
Available Categories: [${input.categories}]

Output format MUST be a strict JSON matching this structure:
{
  "verification_code": "STRING OR NULL (set it only if this is a verification email which provides a code)",
  "summary": "STRING (1 short sentence describing the email)",
  "category": "STRING (must be one of the available categories)"
}

Email Content:
Subject: ${input.subject || "No Subject"}
From: ${input.from}
Body:
${input.body}
`;
}

function parseClassificationResult(resultText: string): EmailClassificationResult {
	const jsonMatch = resultText.match(/\{[\s\S]*\}/);
	const jsonString = jsonMatch ? jsonMatch[0] : resultText;
	const json = JSON.parse(jsonString) as Partial<EmailClassificationResult>;

	return {
		verification_code: json.verification_code || null,
		summary: json.summary || null,
		category: json.category || null,
	};
}

export async function classifyEmail(input: {
	categories: string;
	subject: string | null;
	from: string;
	body: string;
}) {
	const model = buildClassifier();
	const prompt = buildPrompt(input);
	console.log(prompt);

	const response = await model.invoke(prompt);
	const resultText = response.content as string;
	return parseClassificationResult(resultText);
}
