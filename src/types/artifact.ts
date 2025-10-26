export type Media = { type: 'image' | 'audio' | 'video'; src: string; alt?: string; poster?: string };
export type Artifact = {
  id: string;
  type?: string;
  title: string;
  summary: string;
  media: Media[];
  transcript?: string; // ← NEW
  provenance?: Record<string, any>;
  tags?: string[];
  theme?: 'museum' | 'journal' | 'gallery';
  privacy?: 'public' | 'private' | 'unlisted';
};
