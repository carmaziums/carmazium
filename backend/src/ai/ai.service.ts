import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

interface FilterCard {
    label: string;
    params: Record<string, string>;
}

export interface AiSearchResult {
    text: string;
    filterCard?: FilterCard;
}

export interface AiChatResult {
    text: string;
    filterCard?: FilterCard;
}

const SEARCH_SYSTEM_PROMPT = `You are Mazium AI, the intelligent car-buying assistant for CarMazium — UK's trusted car marketplace.

The user will describe the kind of car they want in natural language. Your job is to:
1. Understand their requirements
2. Provide a friendly, concise recommendation paragraph (2-3 sentences max)
3. Extract structured search filters from their query

You MUST respond with valid JSON in this exact format:
{
  "text": "Your friendly recommendation text here",
  "filterCard": {
    "label": "Human-readable label for the filter, e.g. 'Red SUV · Under £30,000'",
    "params": {
      // Only include parameters that the user mentioned or implied. Available params:
      // "make": car manufacturer (e.g. "BMW", "Audi", "Toyota")
      // "model": car model (e.g. "3 Series", "A4")
      // "bodyType": one of SEDAN, HATCHBACK, SUV, COUPE, CONVERTIBLE, ESTATE, MPV, PICKUP, VAN
      // "fuelType": one of PETROL, DIESEL, HYBRID, ELECTRIC, PLUGIN_HYBRID, LPG, HYDROGEN_CELL
      // "transmission": one of MANUAL, AUTOMATIC, SEMI_AUTOMATIC, CVT
      // "color": colour name (e.g. "Red", "Black", "White")
      // "minPrice": minimum price as string number
      // "maxPrice": maximum price as string number
      // "minYear": minimum year as string number
      // "maxYear": maximum year as string number
      // "minMileage": minimum mileage as string number
      // "maxMileage": maximum mileage as string number
      // "minDoors": minimum doors as string number
      // "minSeats": minimum seats as string number
    }
  }
}

If the user's query doesn't contain enough information for filters, still provide a helpful recommendation and omit the filterCard. Keep your text warm and helpful. Always respond in JSON only — no markdown wrappers.`;

const CHAT_SYSTEM_PROMPT = `You are Mazium AI, the friendly car-buying assistant for CarMazium — UK's trusted car marketplace.

About CarMazium:
- A platform to buy and sell cars in UK
- Features: verified sellers, retail listings, live auctions, ULEZ compliance info, car finance, insurance
- Users can browse listings at /search, sell cars at /sell, view auctions at /auctions
- Every listing includes: make, model, year, mileage, price, fuel type, transmission, body type, colour, condition
- The platform supports HPI checks, DVLA lookups, and buyer protection

Your personality:
- Warm, knowledgeable, and efficient
- British English (colour, tyre, boot, bonnet, etc.)
- Keep responses concise (2-4 sentences usually)
- If the user asks about a specific car type, suggest search filters

When you want to suggest car search filters, include a filterCard in your response JSON.

You MUST respond with valid JSON in this exact format:
{
  "text": "Your response text here",
  "filterCard": null
}

Or with a filter card:
{
  "text": "Your response text here",
  "filterCard": {
    "label": "Human-readable filter label",
    "params": {
      // Same params as listed: make, model, bodyType, fuelType, transmission, color, minPrice, maxPrice, minYear, maxYear, minMileage, maxMileage, minDoors, minSeats
    }
  }
}

Always respond in JSON only — no markdown wrappers.`;

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private openai: OpenAI;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (!apiKey) {
            this.logger.warn('OPENAI_API_KEY not configured — AI features will return fallback responses');
        }
        this.openai = new OpenAI({ apiKey: apiKey || '' });
    }

    async searchRecommendation(query: string): Promise<AiSearchResult> {
        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: SEARCH_SYSTEM_PROMPT },
                    { role: 'user', content: query },
                ],
                temperature: 0.7,
                max_tokens: 500,
                response_format: { type: 'json_object' },
            });

            const content = completion.choices[0]?.message?.content?.trim();
            if (!content) {
                return { text: 'I couldn\'t process that query. Try describing the car you\'re looking for!' };
            }

            const cleanContent = content.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
            const parsed = JSON.parse(cleanContent) as AiSearchResult;
            return parsed;
        } catch (error) {
            this.logger.error('OpenAI search error:', error);
            return {
                text: 'I\'m having trouble processing your request right now. Try using the search filters to find your perfect car!',
            };
        }
    }

    async chatCompletion(
        messages: { role: 'user' | 'assistant'; content: string }[],
    ): Promise<AiChatResult> {
        try {
            // Build messages array with system prompt + last 10 conversation messages
            const conversationMessages = messages.slice(-10);
            const openAiMessages: OpenAI.ChatCompletionMessageParam[] = [
                { role: 'system', content: CHAT_SYSTEM_PROMPT },
                ...conversationMessages.map((m) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                })),
            ];

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: openAiMessages,
                temperature: 0.7,
                max_tokens: 500,
                response_format: { type: 'json_object' },
            });

            const content = completion.choices[0]?.message?.content?.trim();
            if (!content) {
                return { text: 'I couldn\'t generate a response. Could you try rephrasing?' };
            }

            const cleanContent = content.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
            const parsed = JSON.parse(cleanContent) as AiChatResult;
            return parsed;
        } catch (error) {
            this.logger.error('OpenAI chat error:', error);
            return {
                text: 'I\'m having a brief moment — please try again in a second! 🔄',
            };
        }
    }

    async generateDescription(data: Record<string, any>): Promise<{ text: string }> {
        try {
            const prompt = `You are a professional automotive copywriter for CarMazium, UK's premium car marketplace.
Your task is to write a compelling, concise, and sales-optimized vehicle description based on the following details.
Do NOT use markdown, asterisks, or formatting. Just return the raw text, divided into short, readable paragraphs.
Make it sound enthusiastic but honest and professional. Highlight key features and condition.

Vehicle Details:
${JSON.stringify(data, null, 2)}
`;

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are an automotive copywriter. Respond ONLY with the raw description text. No markdown, no json wrappers, no asterisks.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 400,
            });

            const content = completion.choices[0]?.message?.content?.trim() || '';

            return { text: content };
        } catch (error) {
            this.logger.error('OpenAI generate description error:', error);
            return {
                text: 'A beautifully presented vehicle currently available for viewing. Please contact for more detailed information, full service history, and to arrange a test drive.',
            };
        }
    }
}
