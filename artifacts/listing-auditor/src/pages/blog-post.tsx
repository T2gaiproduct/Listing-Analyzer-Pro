import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Badge } from "@/components/ui/badge";
import { formatBlogDate, formatReadTime, type PublicBlogPost } from "@/lib/blog";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fetchBlogPost(slug: string): Promise<PublicBlogPost | null> {
  return fetch(`${basePath}/api/blog/${encodeURIComponent(slug)}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

function renderContent(content: string) {
  return content.split(/\n\n+/).map((paragraph, index) => (
    <p key={index} className="text-slate-600 leading-relaxed mb-5 last:mb-0 whitespace-pre-wrap">
      {paragraph}
    </p>
  ));
}

export default function BlogPost({ slug }: { slug: string }) {
  const { data: post, isLoading } = useQuery({
    queryKey: ["public-blog-post", slug],
    queryFn: () => fetchBlogPost(slug),
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-white">
        <PublicNav />
        <main className="max-w-3xl mx-auto px-8 py-20 text-center text-slate-500">Loading article…</main>
        <PublicFooter />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-[100dvh] bg-white">
        <SeoHead title="Post Not Found" description="This blog post could not be found." />
        <PublicNav />
        <main className="max-w-3xl mx-auto px-8 py-20 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Post not found</h1>
          <p className="text-slate-500 mb-6">This article may be unpublished or no longer available.</p>
          <Link href="/blog" className="text-orange-600 font-medium hover:underline inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to blog
          </Link>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const date = formatBlogDate(post.publishedAt ?? post.createdAt);
  const readTime = formatReadTime(post.readMinutes);

  return (
    <div className="min-h-[100dvh] bg-white">
      <SeoHead
        title={post.seoTitle || post.title}
        description={post.seoDescription || post.excerpt || ""}
      />
      <PublicNav />

      <main>
        {post.featuredImage && (
          <div className="w-full max-h-[420px] overflow-hidden bg-slate-100">
            <img src={post.featuredImage} alt={post.title} className="w-full h-full max-h-[420px] object-cover" />
          </div>
        )}

        <article className="max-w-3xl mx-auto px-8 py-12 md:py-16">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-orange-600 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to blog
          </Link>

          {post.category && (
            <Badge className="mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">{post.category}</Badge>
          )}

          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">{post.title}</h1>

          {post.excerpt && (
            <p className="text-lg text-slate-500 mb-6 leading-relaxed">{post.excerpt}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 pb-8 mb-8 border-b border-slate-200">
            {post.author && (
              <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {post.author}</span>
            )}
            {date && <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {date}</span>}
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {readTime} read</span>
          </div>

          {post.content ? (
            <div className="prose prose-slate max-w-none">
              {renderContent(post.content)}
            </div>
          ) : (
            <p className="text-slate-500">This post has no content yet.</p>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-slate-200">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
