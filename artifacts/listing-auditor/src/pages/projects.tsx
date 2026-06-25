import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function ProjectsPage() {
  const [, nav] = useLocation();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-100">
        <div className="flex items-start justify-between">
          <div className="max-w-md">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Create Professional<br />Product Graphics
            </h1>
            <p className="text-slate-500 mb-6">
              Generate stunning lifestyle images and feature graphics for your products in minutes.
            </p>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6 py-2.5 font-semibold"
              onClick={() => nav("/projects/create")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Project
            </Button>
          </div>
          <div className="hidden md:block">
            <img
              src="https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=200&h=200&fit=crop"
              alt="Product"
              className="w-40 h-40 rounded-full object-cover border-4 border-white shadow-lg"
            />
          </div>
        </div>
      </div>

    </div>
  );
}
