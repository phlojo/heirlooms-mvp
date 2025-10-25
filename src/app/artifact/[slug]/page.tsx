// src/app/artifact/[slug]/page.tsx

import { supabase } from '../../../lib/supabase';

// Minimal local types to avoid alias issues
type Media = { type: 'image' | 'audio' | 'video'; src: string; alt?: string; poster?: string };
type Artifact = { title?: string; summary?: string; media?: Media[] };

async function getArtifact(slug: string) {
  const { data, error } = await supabase
    .from('artifacts')
    .select('json')
    .eq('slug', slug)
    .single();

  if (error) return { error: error.message, artifact: null as Artifact | null };
  return { error: null, artifact: (data?.json as Artifact) ?? null };
}

// Next.js 16: params is a Promise — unwrap it
export default async function ArtifactPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;

  const { artifact, error } = await getArtifact(slug);

  if (error) {
    return (
      <pre style={{ padding: 16, color: 'crimson', whiteSpace: 'pre-wrap' }}>
        Fetch error: {error}
        {'\n'}Slug: {slug}
      </pre>
    );
  }

  if (!artifact) {
    return <div className="p-6">Not found for slug: {slug}</div>;
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-3xl font-semibold">{artifact.title || '(untitled)'}</h1>
      {artifact.summary && <p className="text-gray-600">{artifact.summary}</p>}
      <div className="grid grid-cols-1 gap-4">
        {artifact.media?.map((m, i) => (
          <figure key={i} className="rounded overflow-hidden border">
            {m.type === 'image' && <img src={m.src} alt={m.alt ?? ''} />}
            {m.type === 'audio' && <audio controls src={m.src} />}
            {m.type === 'video' && <video controls poster={m.poster} src={m.src} />}
          </figure>
        ))}
      </div>

      {/* Optional: debug the JSON
      <pre className="text-xs bg-gray-50 p-3 border rounded">
        {JSON.stringify(artifact, null, 2)}
      </pre>
      */}
    </main>
  );
}
