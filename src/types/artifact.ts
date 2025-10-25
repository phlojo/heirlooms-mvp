export type Media = { type: 'image' | 'audio' | 'video'; src: string; alt?: string; poster?: string };
export type Artifact = {
  id: string;
  type?: string; // car | watch | product | custom
  title: string;
  summary: string;
  media: Media[];
  provenance?: Record<string, any>; // maker, model, year, history[]
  tags?: string[];
  theme?: 'museum' | 'journal' | 'gallery';
  privacy?: 'public' | 'private' | 'unlisted';
};