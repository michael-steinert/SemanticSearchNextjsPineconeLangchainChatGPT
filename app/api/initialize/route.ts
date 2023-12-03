import { Pinecone } from "@pinecone-database/pinecone";
import { Document } from "langchain/document";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { NextResponse } from "next/server";
import {
  createPineconeIndex,
  updatePinecone,
} from "../../../src/services/pinecone";

export async function GET() {
  const loader: DirectoryLoader = new DirectoryLoader("./documents", {
    ".txt": (path: string) => new TextLoader(path),
    ".md": (path: string) => new TextLoader(path),
    ".pdf": (path: string) => new PDFLoader(path),
  });
  const documents: Document<Record<string, any>>[] = await loader.load();
  const vectorDimensions: number = 1536;
  const pineconeClient: Pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || "",
    environment: process.env.PINECONE_ENVIRONMENT || "",
  });
  try {
    await createPineconeIndex(pineconeClient, vectorDimensions);
    await updatePinecone(pineconeClient, documents);
  } catch (error: any) {
    console.error(error);
  }
  return NextResponse.json({
    data: "Successfully created Index and loaded Data into Pinecone Database.",
  });
}
