import { Pinecone } from "@pinecone-database/pinecone";
import { NextRequest, NextResponse } from "next/server";
import { queryPineconeVectorStoreAndQueryLLM } from "../../../src/services/pinecone";

export async function POST(req: NextRequest) {
  const body: any = await req.json();
  const pineconeClient: Pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || "",
    environment: process.env.PINECONE_ENVIRONMENT || "",
  });
  const text: string = await queryPineconeVectorStoreAndQueryLLM(
    pineconeClient,
    body
  );
  return NextResponse.json({
    data: text,
  });
}
