import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'../components/ui/Select';
import { Button } from '../components/ui/Button';
import { ResourceCard } from '../components/resources/ResourceCard';
import { currentMember, resources, resourceSources, resourceTags } from '../data/portal';

const ALL_SOURCES = 'all';

export function Resources() {
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [source, setSource] = useState(ALL_SOURCES);

  const toggleTag = (tag: string) => {
    setActiveTags((current) =>
    current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  };

  const clearFilters = () => {
    setQuery('');
    setActiveTags([]);
    setSource(ALL_SOURCES);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return resources.filter((resource) => {
      const matchesQuery =
      needle.length === 0 ||
      resource.title.toLowerCase().includes(needle) ||
      resource.preview.toLowerCase().includes(needle);
      const matchesTags =
      activeTags.length === 0 || activeTags.some((tag) => resource.tags.includes(tag));
      const matchesSource = source === ALL_SOURCES || resource.source === source;
      return matchesQuery && matchesTags && matchesSource;
    });
  }, [query, activeTags, source]);

  const filtersActive = query.length > 0 || activeTags.length > 0 || source !== ALL_SOURCES;

  return (
    <div className="space-y-6 lg:space-y-8">
      <header>
        <p className="eyebrow text-muted-foreground">Library</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
          Resources
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Curriculum, practice tools, and templates. Items marked with a lock are limited to your
          role — you are signed in as a {currentMember.role.toLowerCase()}.
        </p>
      </header>

      <section aria-labelledby="filters-heading" className="space-y-4 border-y border-border py-4">
        <h2 id="filters-heading" className="sr-only">
          Search and filter resources
        </h2>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <Label htmlFor="resource-search" className="mb-1.5 block text-sm font-medium">
              Search resources
            </Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              
              <Input
                id="resource-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Title or description"
                className="min-h-tap border-input pl-9" />
              
            </div>
          </div>

          <div className="lg:w-64">
            <Label htmlFor="resource-source" className="mb-1.5 block text-sm font-medium">
              Source
            </Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="resource-source" className="min-h-tap w-full border-input">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SOURCES}>All sources</SelectItem>
                {resourceSources.map((item) =>
                <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            Filter by topic
          </p>
          <ul className="flex flex-wrap gap-2">
            {resourceTags.map((tag) => {
              const active = activeTags.includes(tag);
              return (
                <li key={tag}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex min-h-tap items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-fast ease-standard ${
                    active ?
                    'border-primary bg-primary text-primary-foreground' :
                    'border-border-strong bg-card text-foreground hover:bg-muted'}`
                    }>
                    
                    {tag}
                    {active ? <X aria-hidden="true" className="h-3.5 w-3.5" /> : null}
                  </button>
                </li>);

            })}
          </ul>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {filtered.length} of {resources.length} resources
        </p>
        {filtersActive ?
        <Button
          variant="ghost"
          onClick={clearFilters}
          className="min-h-tap text-foreground underline decoration-border-strong underline-offset-4">
          
            Clear filters
          </Button> :
        null}
      </div>

      {filtered.length === 0 ?
      <div className="rounded-lg border border-dashed border-border-strong bg-card px-6 py-12 text-center">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            No resources match those filters
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Try removing a topic filter or searching a broader term. You can also ask the national
            office to add something to the library.
          </p>
          <Button variant="outline" onClick={clearFilters} className="mt-5 min-h-tap border-border-strong">
            Clear filters
          </Button>
        </div> :

      <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtered.map((resource) =>
        <li key={resource.id}>
              <ResourceCard
            resource={resource}
            locked={resource.access === 'leadership'} />
          
            </li>
        )}
        </ul>
      }
    </div>);

}