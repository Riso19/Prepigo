import Header from "@/components/Header";
import UploadResourceDialog from "@/components/resources/UploadResourceDialog";
import ResourceCard from "@/components/resources/ResourceCard";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useResources } from "@/contexts/ResourcesContext";
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";

const ResourcesPage = () => {
  const { items, isLoading } = useResources();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [tag, setTag] = useState<string>("all");
  const [sort, setSort] = useState<string>("newest");

  const uniqueTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => (it.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let base = items.filter((it) => {
      if (tag !== "all" && !(it.tags || []).includes(tag)) return false;
      if (!needle) return true;
      return (
        it.title.toLowerCase().includes(needle) ||
        (it.description?.toLowerCase().includes(needle) ?? false) ||
        (it.tags || []).some((t) => t.toLowerCase().includes(needle))
      );
    });
    if (tab === "tagged") base = base.filter((it) => (it.tags?.length ?? 0) > 0);
    if (tab === "untagged") base = base.filter((it) => (it.tags?.length ?? 0) === 0);

    base = [...base].sort((a, b) => {
      switch (sort) {
        case "name-asc":
          return a.title.localeCompare(b.title);
        case "name-desc":
          return b.title.localeCompare(a.title);
        case "size-desc":
          return (b.size || 0) - (a.size || 0);
        case "size-asc":
          return (a.size || 0) - (b.size || 0);
        case "newest":
        default:
          return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
      }
    });

    return base;
  }, [items, q, tab, tag, sort]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 bg-secondary/50 rounded-lg my-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Resources</h1>
            <p className="text-muted-foreground">Organize and view your PDF documents offline.</p>
          </div>
          <UploadResourceDialog />
        </div>
        <Separator className="my-4" />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, description, or tag..."
            className="max-w-xl"
            aria-label="Search resources"
          />
          <Tabs value={tab} onValueChange={setTab} className="md:ml-auto">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="tagged">Tagged</TabsTrigger>
              <TabsTrigger value="untagged">Untagged</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {uniqueTags.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="name-asc">Name A–Z</SelectItem>
              <SelectItem value="name-desc">Name Z–A</SelectItem>
              <SelectItem value="size-desc">Size: Large to Small</SelectItem>
              <SelectItem value="size-asc">Size: Small to Large</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">Loading resources...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center max-w-xl mx-auto">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">No resources found</h2>
            <p className="text-muted-foreground mb-4">Upload your first PDF to get started, or adjust your filters.</p>
            <div className="flex justify-center"><UploadResourceDialog /></div>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-6">
            {filtered.map((it) => (
              <ResourceCard key={it.id} item={it} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ResourcesPage;
