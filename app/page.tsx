import { ChangeEvent, useState } from "react";

export default function Home() {
  const [query, setQuery] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  async function createIndexAndEmbeddings() {
    try {
      const response: Response = await fetch("/api/initialize", {
        method: "GET",
      });
      const json: any = await response.json();
      console.log("Result: ", json);
    } catch (error: any) {
      console.error(error);
    }
  }

  async function sendQuery() {
    if (!query) {
      return;
    }
    setResult("");
    setLoading(true);
    try {
      const response: Response = await fetch("/api/read", {
        method: "POST",
        body: JSON.stringify(query),
      });
      const json: any = await response.json();
      setResult(json.data);
      setLoading(false);
    } catch (error: any) {
      console.error(error);
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-between p-24">
      <input
        className="text-black px-2 py-1"
        onChange={(changeEvent: ChangeEvent<HTMLInputElement>) =>
          setQuery(changeEvent.target.value)
        }
      />
      <button
        className="px-7 py-1 rounded-2xl bg-white text-black mt-2 mb-2"
        onClick={sendQuery}
      >
        Ask GPT
      </button>
      {loading && <p>Asking GPT</p>}
      {result && <p>{result}</p>}
      <button onClick={createIndexAndEmbeddings}>
        Create Index and Embeddings
      </button>
    </main>
  );
}
