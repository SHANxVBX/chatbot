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

const stopWords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 
  'will', 'with', 'what', 'who', 'when', 'where', 'why', 'how', 'i', 'you', 
  'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'your', 'yours', 
  'yourself', 'yourselves', 'him', 'his', 'himself', 'she', 'her', 'hers', 
  'herself', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 
  'about', 'above', 'after', 'again', 'against', 'all', 'am', 'any', 'both', 
  'but', 'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 
  'during', 'each', 'few', 'further', 'had', 'having', 'here', 'into', 
  'just', 'more', 'most', 'no', 'nor', 'not', 'now', 'only', 'or', 'other', 
  'out', 'over', 'own', 'same', 'should', 'so', 'some', 'such', 'than', 
  'then', 'there', 'these', 'this', 'those', 'through', 'too', 'under', 
  'until', 'up', 'very', "what's", "what is", 'whats'
]);

function normalizeQuery(query: string): string {
  let normalized = query.toLowerCase();
  // Remove punctuation (simple regex, can be expanded)
  normalized = normalized.replace(/[^\w\s]/gi, '');
  normalized = normalized.split(/\s+/).filter(word => !stopWords.has(word)).join(' ');
  return normalized.trim();
}


async function webSearch(query: string): Promise<string> {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return 'Unable to find current information online. Please check a reliable news source.';
  }

  const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(normalizedQuery)}&format=json&no_html=1&skip_disambig=1`;

  try {
    const response = await fetch(searchUrl);
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'N/A');
      const errorMessage = `DuckDuckGo API error: Status ${response.status} ${response.statusText}. Body: ${errorBody}`;
      console.error(errorMessage);

      let userFacingError = 'An error occurred while searching online.';
      if (response.status >= 400 && response.status < 500) {
          userFacingError = `Error with search request (Status: ${response.status}).`;
      } else if (response.status >= 500) {
          userFacingError = `Search service temporarily unavailable (Status: ${response.status}).`;
      }
      return userFacingError;
    }
    const data = (await response.json()) as DuckDuckGoResponse;

    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    const relevantTopics = (data.RelatedTopics || [])
      .filter(topic => {
        if (!topic.FirstURL || !topic.Text) return false;
        const topicTextLower = topic.Text.toLowerCase();
        
        const hasRecentDate = topicTextLower.includes(String(currentYear)) || topicTextLower.includes(String(nextYear));
        
        let hasKeywords = false;
        // Specific keyword check for "president" and "United States" as requested
        if (normalizedQuery.includes("president") && (normalizedQuery.includes("united states") || normalizedQuery.includes("us"))) {
            hasKeywords = topicTextLower.includes("president") && (topicTextLower.includes("united states") || topicTextLower.includes("u.s."));
        } else {
            // General keyword relevance: check if topic text contains any of the normalized query terms
            const queryTerms = normalizedQuery.split(' ');
            hasKeywords = queryTerms.some(term => topicTextLower.includes(term));
        }

        return hasRecentDate || hasKeywords;
      })
      .slice(0, 3);

    if (relevantTopics.length === 0) {
      return 'Unable to find current information online. Please check a reliable news source.';
    }

    const markdownResults = relevantTopics
      .map((topic, index) => {
        // Attempt to extract a more meaningful title if possible
        let title = topic.Text.split(' - ')[0];
        if (title.length > 70) title = topic.Text.substring(0, 70) + "..."; // Truncate long titles

        // Create a snippet
        let snippet = topic.Text;
        if (topic.Result) { // Result often contains HTML, try to strip it
            const htmlRemovedResult = topic.Result.replace(/<[^>]*>/g, ' ');
            snippet = htmlRemovedResult.length > topic.Text.length ? htmlRemovedResult : topic.Text;
        }
        snippet = snippet.replace(/\s+/g, ' ').trim(); // Clean up extra spaces
        snippet = snippet.substring(0, 150) + (snippet.length > 150 ? '...' : '');


        return `${index + 1}. **[${title}](${topic.FirstURL})**\n   *${snippet}* [Read more](${topic.FirstURL})`;
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
