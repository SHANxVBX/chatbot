'use server';
/**
 * @fileOverview This file implements a Genkit flow for AI-enhanced web search using DuckDuckGo.
 *
 * - smartWebSearch - A function that performs a web search and returns formatted results.
 * - SmartWebSearchInput - The input type for the smartWebSearch function.
 * - SmartWebSearchOutput - The return type for the smartWebSearch function.
 */

import fetch from 'node-fetch'; // Using node-fetch as standard fetch might not be available in all Node.js environments for Genkit flows
import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SmartWebSearchInputSchema = z.object({
  query: z.string().describe('The search query to use for web search.'),
});
export type SmartWebSearchInput = z.infer<typeof SmartWebSearchInputSchema>;

const SmartWebSearchOutputSchema = z.object({
  searchResultsMarkdown: z
    .string()
    .describe(
      'Formatted markdown string of search results, or a message indicating no results/error.'
    ),
});
export type SmartWebSearchOutput = z.infer<typeof SmartWebSearchOutputSchema>;

export async function smartWebSearch(input: SmartWebSearchInput): Promise<SmartWebSearchOutput> {
  return smartWebSearchFlow(input);
}

interface DuckDuckGoTopic {
  Result?: string;
  Icon?: { URL?: string; Height?: number; Width?: number };
  FirstURL: string;
  Text: string;
}

interface DuckDuckGoResponse {
  AbstractText?: string;
  AbstractSource?: string;
  AbstractURL?: string;
  Image?: string;
  Heading?: string;
  Answer?: string;
  AnswerType?: string;
  Definition?: string;
  DefinitionSource?: string;
  DefinitionURL?: string;
  RelatedTopics?: DuckDuckGoTopic[];
  Results?: DuckDuckGoTopic[];
  Type?: 'A' | 'D' | 'C' | 'E' | 'I' | 'L' | 'M' | 'N' | 'P' | 'S' | 'R' | 'T' | 'X' | 'Z'; // A=Article, D=Disambiguation, C=Category, N=Name, E=Exclusive, I=Image
}


async function webSearch(query: string): Promise<string> {
  const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

  try {
    const response = await fetch(searchUrl);
    if (!response.ok) {
      console.error(`DuckDuckGo API error: ${response.status} ${response.statusText}`);
      return 'An error occurred while searching online.';
    }
    const data = (await response.json()) as DuckDuckGoResponse;

    const relevantTopics = data.RelatedTopics?.filter(topic => topic.FirstURL && topic.Text).slice(0, 3) || [];

    if (relevantTopics.length === 0) {
      return 'No relevant information found online.';
    }

    const markdownResults = relevantTopics
      .map((topic, index) => {
        const title = topic.Text.split(' - ')[0]; // Often Text is "Title - Source", take the title part
        const snippet = topic.Text.substring(0, 150) + (topic.Text.length > 150 ? '...' : '');
        return `${index + 1}. [${title}](${topic.FirstURL})\n   *${snippet}* [Read more](${topic.FirstURL})`;
      })
      .join('\n\n');

    return markdownResults;
  } catch (error) {
    console.error('Error performing web search with DuckDuckGo:', error);
    return 'An error occurred while searching online.';
  }
}

const smartWebSearchFlow = ai.defineFlow(
  {
    name: 'smartWebSearchFlow',
    inputSchema: SmartWebSearchInputSchema,
    outputSchema: SmartWebSearchOutputSchema,
  },
  async (input: SmartWebSearchInput) => {
    const searchResultsMarkdown = await webSearch(input.query);
    return { searchResultsMarkdown };
  }
);
