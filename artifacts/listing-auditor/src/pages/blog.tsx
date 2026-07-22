import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PublicNav, PublicFooter } from "@/components/public-layout";
import { PageSeo } from "@/components/page-seo";
import { Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBlogDate, formatReadTime, type PublicBlogPost } from "@/lib/blog";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fetchPublishedPosts(): Promise<PublicBlogPost[]> {
  return fetch(`${basePath}/api/blog`)
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
}

function PostImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn("w-full h-full object-cover", className)}
        loading="lazy"
      />
    );
  }
  return (
    <div className={cn("w-full h-full bg-slate-100 flex items-center justify-center", className)}>
      <span className="text-slate-400 text-sm">Article Image</span>
    </div>
  );
}

function PostCard({ post, featured = false }: { post: PublicBlogPost; featured?: boolean }) {
  const date = formatBlogDate(post.publishedAt ?? post.createdAt);
  const readTime = formatReadTime(post.readMinutes);

  if (featured) {
    return (
      <Link href={`/blog/${post.slug}`} className="group block">
        <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="grid md:grid-cols-2">
            <div className="bg-slate-800 min-h-[240px] overflow-hidden">
              <PostImage src={post.featuredImage} alt={post.title} className="min-h-[240px]" />
            </div>
            <div className="p-8 md:p-10 flex flex-col justify-center">
              {post.category && (
                <Badge className="w-fit mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">{post.category}</Badge>
              )}
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3 group-hover:text-orange-600 transition-colors">{post.title}</h2>
              {post.excerpt && <p className="text-slate-500 mb-6 leading-relaxed">{post.excerpt}</p>}
              <div className="flex items-center gap-4 text-sm text-slate-400">
                {date && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {date}</span>}
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {readTime} read</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/blog/${post.slug}`} className="group block h-full">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-full flex flex-col hover:shadow-md transition-shadow">
        <div className="h-40 overflow-hidden">
          <PostImage src={post.featuredImage} alt={post.title} className="h-40" />
        </div>
        <div className="p-6 flex-1 flex flex-col">
          {post.category && <Badge variant="outline" className="w-fit mb-3 text-xs">{post.category}</Badge>}
          <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">{post.title}</h3>
          {post.excerpt && <p className="text-sm text-slate-500 mb-4 line-clamp-3 flex-1">{post.excerpt}</p>}
          <div className="flex items-center justify-between text-xs text-slate-400 mt-auto">
            {date ? <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {date}</span> : <span />}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {readTime}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Blog() {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["public-blog"],
    queryFn: fetchPublishedPosts,
  });

  const featured = posts[0];
  const regular = posts.slice(1);

  return (
    <div className="min-h-[100dvh] bg-white">
      <PageSeo
        pageSlug="blog"
        title="Blog"
        description="Expert tips, strategies, and insights to help you dominate Amazon search results and grow your sales with SellerLens."
      />
      <PublicNav />

      <main>
        <section className="bg-slate-900 text-white py-20 md:py-28">
          <div className="max-w-4xl mx-auto px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">SellerLens Blog</h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Expert tips, strategies, and insights to help you dominate Amazon search results and grow your sales.
            </p>
          </div>
        </section>

        {isLoading ? (
          <section className="py-16">
            <div className="max-w-6xl mx-auto px-8 text-center text-slate-500">Loading posts…</div>
          </section>
        ) : posts.length === 0 ? (
          <section className="py-16 md:py-24">
            <div className="max-w-xl mx-auto px-8 text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">No posts yet</h2>
              <p className="text-slate-500">Check back soon for new articles from our team.</p>
            </div>
          </section>
        ) : (
          <>
            {featured && (
              <section className="py-12 md:py-16 bg-slate-50">
                <div className="max-w-6xl mx-auto px-8">
                  <PostCard post={featured} featured />
                </div>
              </section>
            )}

            {regular.length > 0 && (
              <section className="py-12 md:py-16 bg-white">
                <div className="max-w-6xl mx-auto px-8">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {regular.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        <section className="py-16 md:py-20 bg-slate-900 text-white">
          <div className="max-w-xl mx-auto px-8 text-center">
            <h2 className="text-2xl font-bold mb-3">Get weekly Amazon selling tips</h2>
            <p className="text-slate-400 mb-8">Join 5,000+ sellers who get actionable listing optimization advice delivered to their inbox.</p>
            <div className="flex gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button className="px-5 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shrink-0">
                Subscribe
              </button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
