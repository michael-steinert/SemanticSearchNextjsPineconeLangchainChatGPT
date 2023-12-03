import {
  Index,
  IndexList,
  Pinecone,
  QueryResponse,
  RecordMetadata,
} from "@pinecone-database/pinecone";
import { StuffDocumentsChain, loadQAStuffChain } from "langchain/chains";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { OpenAI, OpenAICallOptions } from "langchain/llms/openai";
import { ChainValues } from "langchain/schema";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { indexName, timeout } from "../../config";

type PdfVector = {
  id: string;
  values: number[];
  metadata: {
    loc: string;
    pageContent: string;
    txtPath: string;
  };
};

export const createPineconeIndex = async (
  pineconeClient: Pinecone,
  vectorDimension
) => {
  const existingIndexes: IndexList = await pineconeClient.listIndexes();
  if (!existingIndexes.includes({ name: indexName })) {
    // Creating Index
    await pineconeClient.createIndex({
      name: indexName,
      dimension: vectorDimension,
      metric: "cosine",
    });
    console.log(
      `Creating Index. Please wait up to ${
        timeout / 1000
      } Seconds for it to finish Initializing.`
    );
    // Waiting for Index Initialization
    await new Promise((resolve) => setTimeout(resolve, timeout));
  } else {
    console.log(`"${indexName}" already exists.`);
  }
};

export const updatePinecone = async (
  pineconeClient: Pinecone,
  documents: Document<Record<string, any>>[]
) => {
  // Retrieving Pinecone Index
  const index: Index<RecordMetadata> = pineconeClient.Index(indexName);
  console.log(`Pinecone Index retrieved: ${indexName}`);
  // Processing each Document in the Documents
  for (const document of documents) {
    console.log(`Processing document: ${document.metadata.source}`);
    const textSource: string = document.metadata.source;
    const text: string = document.pageContent;
    // Creating RecursiveCharacterTextSplitter Instance to chunk large Amount of Texts
    const textSplitter: RecursiveCharacterTextSplitter =
      new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
      });
    // Splitting Text into Chunks (i.e. Documents)
    const chunks: Document<Record<string, any>>[] =
      await textSplitter.createDocuments([text]);
    console.log(`Text split into ${chunks.length} Chunks`);
    // Creating OpenAI Embeddings for Documents
    const embeddingsArrays: number[][] =
      await new OpenAIEmbeddings().embedDocuments(
        chunks.map((chunk: Document<Record<string, any>>) =>
          // Replacing each Instance of a Line Break with a Whitespace
          chunk.pageContent.replace(/\n/g, " ")
        )
      );
    console.log(
      `Creating ${chunks.length} Vectors Array with ID, Values, and Metadata.`
    );
    // Creating and inserting Vectors in Batches of 100
    const batchSize: number = 100;
    let batch: any = [];
    for (let i: number = 0; i < chunks.length; i++) {
      for (let i: number = 0; i < chunks.length; i++) {
        const chunk: Document<Record<string, any>> = chunks[i];
        const vector: PdfVector = {
          id: `${textSource}_${i}`,
          values: embeddingsArrays[i],
          metadata: {
            ...chunk.metadata,
            loc: JSON.stringify(chunk.metadata.loc),
            pageContent: chunk.pageContent,
            txtPath: textSource,
          },
        };
        // When Batch is full or it is the last Item, then insert the Vectors
        if (batch.length === batchSize || i === chunks.length - 1) {
          // Adding generated Vector to current Batch for Bulk Insertion
          await index.upsert({ ...batch, vector });
          // Empty the Batch
          batch = [];
        }
      }
      console.log(`Pinecone Index updated with ${chunks.length} Vectors.`);
    }
  }
};

export const queryPineconeVectorStoreAndQueryLLM = async (
  pineconeClient: Pinecone,
  question: string
): Promise<string> => {
  const index: Index<RecordMetadata> = pineconeClient.Index(indexName);
  // Creating Query Embedding to call OpenAI to embed Text into Vectors (to store and use on Pinecone)
  const queryEmbedding: number[] = await new OpenAIEmbeddings().embedQuery(
    question
  );
  // Querying Pinecone Index to get Top 10 Matches
  let queryResponse: QueryResponse<RecordMetadata> = await index.query({
    topK: 10,
    vector: queryEmbedding,
    includeMetadata: true,
    includeValues: true,
  });
  let response: string = "";
  if (queryResponse.matches.length) {
    // Creating an OpenAI Instance
    const llm: OpenAI<OpenAICallOptions> = new OpenAI({});
    // Loading the QAStuffChain, which is a generic Question / Answer API for asking Questions about Text (Documents)
    // The StuffDocumentsChain injects all Input Documents into the Prompt as Context and returns the Answer to the Question
    const stuffDocumentsChain: StuffDocumentsChain = loadQAStuffChain(llm);
    // Extracting and concatenating Page Content from matched Documents
    const concatenatedPageContent: string = queryResponse.matches
      .map((match) => match.metadata?.pageContent)
      .join(" ");
    // Executing the chain with input documents and question
    const chainValues: ChainValues = await stuffDocumentsChain.call({
      input_documents: [new Document({ pageContent: concatenatedPageContent })],
      question: question,
    });
    console.log(`Answer: ${chainValues.text}`);
    response = chainValues.text;
  } else {
    console.log("Since there are no Matches, GPT will not be queried.");
  }
  return response;
};
