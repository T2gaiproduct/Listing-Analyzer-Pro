import { useState } from "react";
import { useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateAudit, getListAuditsQueryKey, getGetAuditStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Loader2, FileSearch, Type, AlignLeft, Image, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  asin: z.string().optional(),
  category: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  bulletPoints: z.array(z.object({ value: z.string() })).min(1, "At least one bullet point is required"),
  imageUrls: z.array(z.object({ value: z.string() })),
  targetKeywords: z.array(z.object({ value: z.string() })).min(1, "At least one keyword is required"),
});

type FormValues = z.infer<typeof formSchema>;

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="p-2 bg-primary/10 rounded-lg text-primary mt-0.5">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function AuditNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createAudit = useCreateAudit();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: "",
      asin: "",
      category: "",
      title: "",
      bulletPoints: [{ value: "" }],
      imageUrls: [{ value: "" }],
      targetKeywords: [{ value: "" }],
    },
  });

  const bulletFields = useFieldArray({ control: form.control, name: "bulletPoints" });
  const imageFields = useFieldArray({ control: form.control, name: "imageUrls" });
  const keywordFields = useFieldArray({ control: form.control, name: "targetKeywords" });

  const [keywordInput, setKeywordInput] = useState("");

  const onSubmit = (values: FormValues) => {
    createAudit.mutate(
      {
        data: {
          productName: values.productName,
          asin: values.asin || undefined,
          category: values.category || undefined,
          title: values.title,
          bulletPoints: values.bulletPoints.map(b => b.value).filter(Boolean),
          imageUrls: values.imageUrls.map(i => i.value).filter(Boolean),
          targetKeywords: values.targetKeywords.map(k => k.value).filter(Boolean),
        },
      },
      {
        onSuccess: (audit) => {
          queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAuditStatsQueryKey() });
          setLocation(`/audits/${audit.id}`);
        },
        onError: () => {
          toast({ title: "Analysis failed", description: "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const addKeywordFromInput = () => {
    if (keywordInput.trim()) {
      keywordFields.append({ value: keywordInput.trim() });
      setKeywordInput("");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="border-b pb-6">
        <h1 className="text-4xl font-bold tracking-tight">New Audit</h1>
        <p className="text-muted-foreground mt-2 text-lg">Enter your Amazon listing details for a comprehensive AI-powered audit.</p>
      </div>

      {createAudit.isPending && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-80 shadow-2xl">
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">Analyzing your listing...</h3>
                <p className="text-muted-foreground text-sm mt-1">Our AI is evaluating title, bullets, images, and keywords</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Product Info */}
          <Card>
            <CardHeader>
              <SectionHeader
                icon={FileSearch}
                title="Product Information"
                description="Basic details to identify your listing"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="productName" render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Wireless Earbuds Pro" data-testid="input-product-name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="asin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ASIN <span className="text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl><Input placeholder="B0XXXXXXXXX" data-testid="input-asin" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category <span className="text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl><Input placeholder="e.g. Electronics, Sports" data-testid="input-category" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Title */}
          <Card>
            <CardHeader>
              <SectionHeader
                icon={Type}
                title="Listing Title"
                description="Your Amazon product title (max 200 characters recommended)"
              />
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="Enter your full Amazon listing title..."
                        className="pr-16"
                        data-testid="input-title"
                        {...field}
                      />
                      <span className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono",
                        (field.value?.length || 0) > 200 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {field.value?.length || 0}/200
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Bullet Points */}
          <Card>
            <CardHeader>
              <SectionHeader
                icon={AlignLeft}
                title="Bullet Points"
                description="Your product feature bullets (5 is ideal, 100-200 chars each)"
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {bulletFields.fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <span className="w-6 h-9 flex items-center justify-center text-xs font-mono text-muted-foreground font-bold shrink-0">{index + 1}</span>
                  <FormField control={form.control} name={`bulletPoints.${index}.value`} render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder={`Bullet point ${index + 1}...`} data-testid={`input-bullet-${index}`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {bulletFields.fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => bulletFields.remove(index)} data-testid={`button-remove-bullet-${index}`}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => bulletFields.append({ value: "" })} data-testid="button-add-bullet" className="mt-2">
                <Plus className="w-4 h-4 mr-2" /> Add Bullet Point
              </Button>
            </CardContent>
          </Card>

          {/* Image URLs */}
          <Card>
            <CardHeader>
              <SectionHeader
                icon={Image}
                title="Product Images"
                description="Image URLs for your listing (7+ recommended for top score)"
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {imageFields.fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <span className="w-6 h-9 flex items-center justify-center text-xs font-mono text-muted-foreground font-bold shrink-0">{index + 1}</span>
                  <FormField control={form.control} name={`imageUrls.${index}.value`} render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="https://..." type="url" data-testid={`input-image-${index}`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {imageFields.fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => imageFields.remove(index)} data-testid={`button-remove-image-${index}`}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => imageFields.append({ value: "" })} data-testid="button-add-image" className="mt-2">
                <Plus className="w-4 h-4 mr-2" /> Add Image URL
              </Button>
            </CardContent>
          </Card>

          {/* Keywords */}
          <Card>
            <CardHeader>
              <SectionHeader
                icon={Tag}
                title="Target Keywords"
                description="Keywords you want to rank for — we'll check if they appear in your listing"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a keyword and press Enter..."
                  value={keywordInput}
                  data-testid="input-keyword"
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeywordFromInput(); } }}
                />
                <Button type="button" variant="outline" onClick={addKeywordFromInput} data-testid="button-add-keyword">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {keywordFields.fields.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {keywordFields.fields.map((field, index) => (
                    <Badge key={field.id} variant="secondary" className="pl-3 pr-1.5 py-1.5 flex items-center gap-1.5 text-sm" data-testid={`keyword-tag-${index}`}>
                      <FormField control={form.control} name={`targetKeywords.${index}.value`} render={({ field }) => (
                        <span>{field.value}</span>
                      )} />
                      <button type="button" onClick={() => keywordFields.remove(index)} className="hover:text-destructive transition-colors" data-testid={`button-remove-keyword-${index}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {form.formState.errors.targetKeywords && (
                <p className="text-sm text-destructive">{form.formState.errors.targetKeywords.message}</p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4 justify-end pb-8">
            <Button type="button" variant="outline" onClick={() => setLocation("/")} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={createAudit.isPending} data-testid="button-submit-audit" className="min-w-36">
              {createAudit.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                <><FileSearch className="w-4 h-4 mr-2" /> Run Audit</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
