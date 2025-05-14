// Using node fetch as the standard library 'fetch' is not available in Node.js.
import fetch from 'node-fetch';
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
'use server';

/**
 * @fileOverview This file implements a Genkit flow for AI-enhanced web search.
 *
 * - smartWebSearch - A function that performs a web search and summarizes the results.
 * - SmartWebSearchInput - The input type for the smartWebSearch function.
 * - SmartWebSearchOutput - The return type for the smartWebSearch function.
 */

const SmartWebSearchInputSchema = z.object({
  query: z.string().describe('The search query to use for web search.'),
});
export type SmartWebSearchInput = z.infer<typeof SmartWebSearchInputSchema>;

const SmartWebSearchOutputSchema = z.object({
  summary: z.string().describe('A summary of the web search results.'),
});
export type SmartWebSearchOutput = z.infer<typeof SmartWebSearchOutputSchema>;

export async function smartWebSearch(input: SmartWebSearchInput): Promise<SmartWebSearchOutput> {
  return smartWebSearchFlow(input);
}

async function webSearch(query: string): Promise<string[]> {
  // Replace with your preferred search API and API key.
  const apiKey = process.env.SERPAPI_API_KEY; 
  if (!apiKey) {
    throw new Error(
      'The environment variable SERPAPI_API_KEY must be set to use web search.'
    );
  }
  const apiUrl = `https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${apiKey}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!data.organic_results) {
      console.warn('No search results found.', data);
      return [];
    }

    // Extract snippets from the search results.
    const snippets = data.organic_results.map((result: any) => result.snippet);
    return snippets;
  } catch (error) {
    console.error('Error performing web search:', error);
    return [];
  }
}

const summarizePrompt = ai.definePrompt({
  name: 'summarizePrompt',
  input: {schema: z.object({results: z.string().describe('Search results')})},
  output: {schema: SmartWebSearchOutputSchema},
  prompt: `Summarize the following search results:\n\n{{results}}`,
});

const smartWebSearchFlow = ai.defineFlow(
  {
    name: 'smartWebSearchFlow',
    inputSchema: SmartWebSearchInputSchema,
    outputSchema: SmartWebSearchOutputSchema,
  },
  async input => {
    const searchResults = await webSearch(input.query);
    const results = searchResults.join('\n\n');
    const {output} = await summarizePrompt({results});
    return output!;
  }
);
