import { PublicNav, PublicFooter } from "@/components/public-layout";
import { SeoHead } from "@/components/seo-head";

export default function Privacy() {
  return (
    <div className="min-h-[100dvh] bg-white">
      <SeoHead
        title="Privacy Policy"
        description="SellerLens Privacy Policy — how we collect, use, and protect your personal data."
      />
      <PublicNav />
      <main className="max-w-3xl mx-auto px-8 py-16 md:py-24">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">Privacy Policy</h1>
        <p className="text-slate-500 mb-12">Last updated: May 14, 2026</p>

        <div className="prose prose-slate max-w-none">
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Information We Collect</h2>
            <p className="text-slate-600 leading-relaxed">
              We collect information you provide directly to us, such as your name, email address, and payment
              information when you create an account or make a purchase. We also collect data about your use of
              the Service, including listing URLs, audit results, and generated content.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. How We Use Your Information</h2>
            <p className="text-slate-600 leading-relaxed">
              We use your information to provide and improve the Service, process transactions, communicate with
              you, and ensure the security of our platform. We may use anonymized data for research and
              analytics purposes.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Data Sharing</h2>
            <p className="text-slate-600 leading-relaxed">
              We do not sell your personal information. We may share data with trusted third-party service
              providers who assist us in operating the Service, such as payment processors and cloud hosting
              providers. All third parties are bound by confidentiality obligations.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Data Security</h2>
            <p className="text-slate-600 leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal data
              against unauthorized access, alteration, disclosure, or destruction. This includes encryption,
              access controls, and regular security audits.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Cookies and Tracking</h2>
            <p className="text-slate-600 leading-relaxed">
              We use cookies and similar technologies to enhance your experience, analyze usage patterns,
              and deliver personalized content. You can control cookie settings through your browser preferences.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Your Rights</h2>
            <p className="text-slate-600 leading-relaxed">
              Depending on your location, you may have the right to access, correct, delete, or restrict the
              processing of your personal data. You may also have the right to data portability and to object
              to certain processing activities. To exercise these rights, please contact us.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Data Retention</h2>
            <p className="text-slate-600 leading-relaxed">
              We retain your personal data for as long as your account is active or as needed to provide you
              with the Service. You may request deletion of your account and associated data at any time.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Children's Privacy</h2>
            <p className="text-slate-600 leading-relaxed">
              The Service is not intended for individuals under the age of 18. We do not knowingly collect
              personal information from children. If you believe we have inadvertently collected such
              information, please contact us immediately.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">9. Changes to This Policy</h2>
            <p className="text-slate-600 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes
              by posting the new policy on the Service and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">10. Contact Us</h2>
            <p className="text-slate-600 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at support@listingauditor.com.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
