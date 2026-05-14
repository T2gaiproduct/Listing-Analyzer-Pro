import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

interface Invoice {
  id: number; userId: string; amount: number; currency: string; status: string;
  items: Array<{ description: string; amount: number; quantity: number }>;
  dueDate: string | null; paidAt: string | null; createdAt: string;
}

function fetchInvoices(): Promise<{ invoices: Invoice[]; total: number }> {
  return fetch("/api/admin/invoices").then((r) => r.json());
}

export default function AdminBillingInvoices() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-invoices"], queryFn: fetchInvoices });
  const invoices = data?.invoices ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Invoices</h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Total: {data?.total ?? 0}</Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        <Card className="p-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No invoices found.</TableCell></TableRow>
                ) : (
                  invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">#{inv.id}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{inv.userId}</TableCell>
                      <TableCell>${inv.amount.toFixed(2)} {inv.currency}</TableCell>
                      <TableCell><Badge variant={inv.status === "paid" ? "default" : inv.status === "unpaid" ? "secondary" : "destructive"}>{inv.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
