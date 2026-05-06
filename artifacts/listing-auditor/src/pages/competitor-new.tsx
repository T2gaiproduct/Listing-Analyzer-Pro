import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAddCompetitor, useGetAudit, getGetAuditQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, X, Loader2, Users } from "lucide-react";

const formSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  asin: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  bulletPoints: z.array(z.object({ value: z.string() })).min(1),
  imageCount: z.coerce.number().min(0).max(20),
  targetKeywords: z.array(z.object({ value: z.string() })).min(1),
});

type FormValues = z.infer<typeof formSchema>;

export default function CompetitorNew({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addCompetitor = useAddCompetitor();
  const { data: audit } = useGetAudit(id, { query: { enabled: !!id, queryKey: getGetAuditQueryKey(id) } });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: "",
      asin: "",
      title: "",
      bulletPoints: [{ value: "" }],
      imageCount: 0,
      targetKeywords: [{ value: "" }],
    },
  });

  const bulletFields = useFieldArray({ control: form.control, name: "bulletPoints" });
  const keywordFields = useFieldArray({ control: form.control, name: "targetKeywords" });
  const [keywordInput, setKeywordInput] = useState("");

  const addKeyword = () => {
    if (keywordInput.trim()) {
      keywordFields.append({ value: keywordInput.trim() });
      setKeywordInput("");
    }
  };

  const onSubmit = (values: FormValues) => {
    addCompetitor.mutate(
      {
        id,
        data: {
          productName: values.productName,
          asin: values.asin || undefined,
          title: values.title,
          bulletPoints: values.bulletPoints.map(b => b.value).filter(Boolean),
          imageCount: values.imageCount,
          targetKeywords: values.targetKeywords.map(k => k.value).filter(Boolean),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(id) });
          setLocation(`/audits/${id}`);
          toast({ title: "Competitor added", description: "AI analysis complete." });
        },
        onError: () => {
          toast({ title: "Failed to add competitor", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="border-b pb-6">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link href={`/audits/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <h1 className="text-3xl font-bold tracking-tight">Add Competitor</h1>
            </div>
            {audit && (
              <p className="text-muted-foreground text-sm mt-1">
                Comparing against: <span className="font-medium text-foreground">{audit.productName}</span>
              </p>
            )}
          </div>
        </div>
        <p className="text-muted-foreground ml-11">Enter a competitor listing for AI-powered comparative analysis.</p>
      </div>

      {addCompetitor.isPending && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-80 shadow-2xl">
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">Analyzing competitor...</h3>
                <p className="text-muted-foreground text-sm mt-1">Comparing strengths and weaknesses against your listing</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <h3 className="font-semibold">Competitor Details</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="productName" render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Rival Earbuds X1" data-testid="input-competitor-name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="asin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ASIN <span className="text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl><Input placeholder="B0XXXXXXXXX" data-testid="input-competitor-asin" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="imageCount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image Count</FormLabel>
                    <FormControl><Input type="number" min={0} max={20} placeholder="7" data-testid="input-image-count" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Listing Title *</FormLabel>
                  <FormControl><Input placeholder="Competitor's full Amazon listing title..." data-testid="input-competitor-title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <h3 className="font-semibold">Bullet Points</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {bulletFields.fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <span className="w-6 h-9 flex items-center justify-center text-xs font-mono text-muted-foreground font-bold shrink-0">{index + 1}</span>
                  <FormField control={form.control} name={`bulletPoints.${index}.value`} render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl><Input placeholder={`Bullet point ${index + 1}...`} data-testid={`input-comp-bullet-${index}`} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {bulletFields.fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => bulletFields.remove(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => bulletFields.append({ value: "" })} data-testid="button-add-comp-bullet">
                <Plus className="w-4 h-4 mr-2" /> Add Bullet
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <h3 className="font-semibold">Target Keywords</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a keyword and press Enter..."
                  value={keywordInput}
                  data-testid="input-comp-keyword"
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                />
                <Button type="button" variant="outline" onClick={addKeyword} data-testid="button-add-comp-keyword">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {keywordFields.fields.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {keywordFields.fields.map((field, index) => (
                    <Badge key={field.id} variant="secondary" className="pl-3 pr-1.5 py-1.5 flex items-center gap-1.5 text-sm" data-testid={`comp-keyword-${index}`}>
                      <FormField control={form.control} name={`targetKeywords.${index}.value`} render={({ field }) => (
                        <span>{field.value}</span>
                      )} />
                      <button type="button" onClick={() => keywordFields.remove(index)} className="hover:text-destructive transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4 justify-end pb-8">
            <Button type="button" variant="outline" asChild data-testid="button-cancel">
              <Link href={`/audits/${id}`}>Cancel</Link>
            </Button>
            <Button type="submit" size="lg" disabled={addCompetitor.isPending} data-testid="button-submit-competitor" className="min-w-40">
              {addCompetitor.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                <><Users className="w-4 h-4 mr-2" /> Add Competitor</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
