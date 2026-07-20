import { PublicNav, PublicFooter } from "@/components/public-layout";
import { SeoHead } from "@/components/seo-head";

export default function Terms() {
  return (
    <div className="min-h-[100dvh] bg-white">
      <SeoHead
        title="Terms of Service"
        description="SellerLens Terms of Service — agreement for use of the SellerLens platform and services."
      />
      <PublicNav />
      <main className="max-w-3xl mx-auto px-8 py-16 md:py-24">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">Terms of Service</h1>
        <p className="text-slate-500 mb-12">Last updated: May 14, 2026</p>

        <div className="prose prose-slate max-w-none">
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Acceptance of Terms</h2>
            <p className="text-slate-600 leading-relaxed">
              By accessing or using SellerLens ("the Service"), you agree to be bound by these Terms of Service.
              If you do not agree, you may not use the Service. These terms apply to all visitors, users, and others
              who access or use the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Description of Service</h2>
            <p className="text-slate-600 leading-relaxed">
              SellerLens provides AI-powered tools for analyzing, scoring, and optimizing Amazon product listings.
              The Service includes but is not limited to listing audits, competitor analysis, content generation,
              image analysis, and related features.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. User Accounts</h2>
            <p className="text-slate-600 leading-relaxed">
              You must provide accurate and complete information when creating an account. You are responsible
              for safeguarding your account credentials and for all activities that occur under your account.
              You must notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Subscription and Payments</h2>
            <p className="text-slate-600 leading-relaxed">
              Some features require a paid subscription. Subscription fees are billed in advance on a monthly or
              annual basis. You may cancel your subscription at any time, but no refunds will be provided for
              partial billing periods. We reserve the right to change pricing with 30 days notice.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Acceptable Use</h2>
            <p className="text-slate-600 leading-relaxed">
              You agree not to use the Service for any unlawful purpose or in any way that could damage,
              disable, overburden, or impair the Service. You may not attempt to gain unauthorized access to
              any part of the Service or its related systems.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Intellectual Property</h2>
            <p className="text-slate-600 leading-relaxed">
              All content, features, and functionality of the Service are owned by SellerLens and are protected
              by international copyright, trademark, and other intellectual property laws. You are granted a limited,
              non-exclusive, non-transferable license to use the Service for its intended purpose.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Limitation of Liability</h2>
            <p className="text-slate-600 leading-relaxed">
              The Service is provided "as is" without warranties of any kind. SellerLens shall not be liable
              for any indirect, incidental, special, consequential, or punitive damages arising out of or
              relating to your use of the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Governing Law</h2>
            <p className="text-slate-600 leading-relaxed">
              These Terms shall be governed by the laws of the State of Delaware, United States, without regard
              to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">9. Changes to Terms</h2>
            <p className="text-slate-600 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will provide notice of significant changes
              by posting the new Terms on the Service and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">10. Contact</h2>
            <p className="text-slate-600 leading-relaxed">
              If you have any questions about these Terms, please contact us at support@listingauditor.com.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
