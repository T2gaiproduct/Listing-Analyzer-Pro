import { PublicNav, PublicFooter } from "@/components/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const posts = [
  {
    slug: "amazon-a9-algorithm-2026",
    title: "How the Amazon A9 Algorithm Works in 2026",
    excerpt: "Understanding the ranking signals that determine whether your product appears on page one — and how to optimize for them.",
    category: "SEO",
    readTime: "8 min",
    date: "May 10, 2026",
    featured: true,
  },
  {
    slug: "title-optimization-guide",
    title: "The Complete Guide to Amazon Title Optimization",
    excerpt: "Your product title is the most important piece of real estate on your listing. Here is how to make every character count.",
    category: "Optimization",
    readTime: "12 min",
    date: "Apr 28, 2026",
    featured: false,
  },
  {
    slug: "bullet-points-that-convert",
    title: "Writing Bullet Points That Actually Convert",
    excerpt: "Amazon shoppers skim. These proven frameworks will help your bullet points capture attention and drive clicks.",
    category: "Copywriting",
    readTime: "6 min",
    date: "Apr 15, 2026",
    featured: false,
  },
  {
    slug: "image-optimization-tips",
    title: "7 Image Optimization Tips Every Seller Should Know",
    excerpt: "Images drive conversions. Learn the exact dimensions, layouts, and lifestyle shots that top sellers use.",
    category: "Design",
    readTime: "7 min",
    date: "Mar 22, 2026",
    featured: false,
  },
  {
    slug: "competitor-analysis-framework",
    title: "A Framework for Systematic Competitor Analysis",
    excerpt: "Stop guessing. Use this repeatable process to reverse-engineer what your top competitors are doing right.",
    category: "Strategy",
    readTime: "10 min",
    date: "Mar 8, 2026",
    featured: false,
  },
  {
    slug: "backend-keywords-hidden",
    title: "Backend Keywords: The Hidden SEO Goldmine",
    excerpt: "Most sellers waste their backend keyword slots. Here is how to use all 250 bytes strategically.",
    category: "SEO",
    readTime: "5 min",
    date: "Feb 19, 2026",
    featured: false,
  },
];

export default function Blog() {
  const featured = posts.find((p) => p.featured);
  const regular = posts.filter((p) => !p.featured);

  return (
    <div className="min-h-[100dvh] bg-white">
      <SeoHead
        title="Blog"
        description="Expert tips, strategies, and insights to help you dominate Amazon search results and grow your sales with SellerLens."
      />
      <PublicNav />

      <main>
        {/* Hero */}
        <section className="bg-slate-900 text-white py-20 md:py-28">
          <div className="max-w-4xl mx-auto px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">SellerLens Blog</h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Expert tips, strategies, and insights to help you dominate Amazon search results and grow your sales.
            </p>
          </div>
        </section>

        {/* Featured */}
        {featured && (
          <section className="py-12 md:py-16 bg-slate-50">
            <div className="max-w-6xl mx-auto px-8">
              <div className="group block">
                <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  <div className="grid md:grid-cols-2">
                    <div className="bg-slate-800 min-h-[240px] flex items-center justify-center">
                      <span className="text-slate-400 text-sm">Featured Article Image</span>
                    </div>
                    <div className="p-8 md:p-10 flex flex-col justify-center">
                      <Badge className="w-fit mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">{featured.category}</Badge>
                      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3 group-hover:text-orange-600 transition-colors">{featured.title}</h2>
                      <p className="text-slate-500 mb-6 leading-relaxed">{featured.excerpt}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {featured.date}</span>
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {featured.readTime} read</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Grid */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-6xl mx-auto px-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {regular.map((post) => (
                <div key={post.slug} className="group block">
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-full flex flex-col">
                    <div className="bg-slate-100 h-40 flex items-center justify-center">
                      <span className="text-slate-400 text-sm">Article Image</span>
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <Badge variant="outline" className="w-fit mb-3 text-xs">{post.category}</Badge>
                      <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2">{post.title}</h3>
                      <p className="text-sm text-slate-500 mb-4 line-clamp-3 flex-1">{post.excerpt}</p>
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-auto">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {post.date}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readTime}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter */}
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
