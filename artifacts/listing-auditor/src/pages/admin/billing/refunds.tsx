import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

interface Refund {
  id: number; paymentId: number; userId: string; amount: number; reason: string | null;
  status: string; createdAt: string; processedAt: string | null;
}

function fetchRefunds(): Promise<{ refunds: Refund[] }> {
  return fetch("/api/admin/refunds").then((r) => r.json());
}

export default function AdminBillingRefunds() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-refunds"], queryFn: fetchRefunds });
  const refunds = data?.refunds ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Refunds</h1>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        <Card className="p-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : refunds.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No refunds found.</TableCell></TableRow>
                ) : (
                  refunds.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">#{r.id}</TableCell>
                      <TableCell>#{r.paymentId}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{r.userId}</TableCell>
                      <TableCell>${r.amount.toFixed(2)}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{r.reason || "-"}</TableCell>
                      <TableCell><Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
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
