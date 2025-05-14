'use server';

/**
 * @fileOverview A document summarization AI agent.
 *
 * - summarizeUpload - A function that handles the document summarization process.
 * - SummarizeUploadInput - The input type for the summarizeUpload function.
 * - SummarizeUploadOutput - The return type for the summarizeUpload function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeUploadInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      'A document as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' //eslint-disable-line
    ),
});
export type SummarizeUploadInput = z.infer<typeof SummarizeUploadInputSchema>;

const SummarizeUploadOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the key information within the document.'),
});
export type SummarizeUploadOutput = z.infer<typeof SummarizeUploadOutputSchema>;

export async function summarizeUpload(input: SummarizeUploadInput): Promise<SummarizeUploadOutput> {
  return summarizeUploadFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeUploadPrompt',
  input: {schema: SummarizeUploadInputSchema},
  output: {schema: SummarizeUploadOutputSchema},
  prompt: `You are an expert summarizer.

You will use the document provided to create a concise summary of the key information within it.

Document: {{media url=fileDataUri}}`,
});

const summarizeUploadFlow = ai.defineFlow(
  {
    name: 'summarizeUploadFlow',
    inputSchema: SummarizeUploadInputSchema,
    outputSchema: SummarizeUploadOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
