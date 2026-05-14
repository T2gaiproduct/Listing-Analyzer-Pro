import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, RefreshCw } from "lucide-react";

interface Coupon {
  id: number; code: string; description: string | null; discountPercent: number | null;
  discountAmount: number | null; maxUses: number; usedCount: number;
  expiryDate: string | null; isActive: boolean;
}

function fetchCoupons(): Promise<{ coupons: Coupon[] }> {
  return fetch("/api/admin/coupons").then((r) => r.json());
}

export default function AdminBillingCoupons() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", description: "", discountPercent: "", discountAmount: "", maxUses: "1", expiryDate: "" });

  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-coupons"], queryFn: fetchCoupons });
  const coupons = data?.coupons ?? [];

  const create = useMutation({
    mutationFn: (body: object) => fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-coupons"] }); setOpen(false); setForm({ code: "", description: "", discountPercent: "", discountAmount: "", maxUses: "1", expiryDate: "" }); },
  });

  const del = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/coupons/${id}`, { method: "DELETE" }).then((r) => r.ok),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      fetch(`/api/admin/coupons/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Coupons</h1>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Coupon</Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        <Card className="p-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : coupons.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No coupons found.</TableCell></TableRow>
                ) : (
                  coupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-medium">{c.code}</TableCell>
                      <TableCell>
                        {c.discountPercent ? `${c.discountPercent}%` : c.discountAmount ? `$${c.discountAmount}` : "-"}
                      </TableCell>
                      <TableCell>{c.usedCount}/{c.maxUses}</TableCell>
                      <TableCell className="text-muted-foreground">{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : "No expiry"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => toggle.mutate({ id: c.id, isActive: !c.isActive })}>
                          <Badge variant={c.isActive ? "default" : "secondary"}>{c.isActive ? "Active" : "Inactive"}</Badge>
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Coupon</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Input type="number" placeholder="Discount %" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
              <Input type="number" placeholder="Discount $" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} />
              <Input type="number" placeholder="Max uses" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
              <Input type="date" placeholder="Expiry" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate({ code: form.code, description: form.description, discountPercent: form.discountPercent ? Number(form.discountPercent) : undefined, discountAmount: form.discountAmount ? Number(form.discountAmount) : undefined, maxUses: Number(form.maxUses), expiryDate: form.expiryDate || undefined })}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
