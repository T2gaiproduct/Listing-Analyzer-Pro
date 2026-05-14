import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download } from "lucide-react";

interface DownloadItem {
  id: number; userId: string; auditId: number | null; type: string; filename: string | null; createdAt: string;
}

function fetchDownloads(): Promise<{ downloads: DownloadItem[] }> {
  return fetch("/api/admin/downloads").then((r) => r.json());
}

export default function AdminContentDownloads() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-downloads"], queryFn: fetchDownloads });
  const downloads = data?.downloads ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Downloads</h1>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        <Card className="p-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Audit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : downloads.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No downloads found.</TableCell></TableRow>
                ) : (
                  downloads.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">#{d.id}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{d.userId}</TableCell>
                      <TableCell>{d.auditId ? <Badge variant="outline">#{d.auditId}</Badge> : "-"}</TableCell>
                      <TableCell className="capitalize">{d.type}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{d.filename || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
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
