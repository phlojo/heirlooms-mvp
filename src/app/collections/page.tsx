import { Page, Tile } from "@/src/components/Ui";

export default function CollectionsHub() {
  return (
    <Page title="Collections">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile href="/collections/mine" title="My Collections" subtitle="Everything you own" />
        <Tile href="/collections/new" title="Create a New Collection" subtitle="Start a fresh set" />
        <Tile href="/collections/all" title="All Collections" subtitle="Public collections from everyone" />
      </div>
    </Page>
  );
}