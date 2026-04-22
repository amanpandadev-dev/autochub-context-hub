import { LLMChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";

const template = "Tell me a joke about {topic}";
const prompt = new PromptTemplate({ template, inputVariables: ["topic"] });

const llm = new OpenAI({ temperature: 0.9 });
const chain = new LLMChain({ llm, prompt });

// Deprecated .run() call
const res = await chain.run("robots");
console.log(res);

// Deprecated .predict() call
const res2 = await chain.predict({ topic: "AI" });
console.log(res2);
