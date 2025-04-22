"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { usePagination } from "@/components/hooks/use-pagination";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ColumnDef,
  PaginationState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Trash2, Upload } from "lucide-react";

type S3File = {
  id: string;
  name: string;
  lastModified: string;
  size: number;
  type: string;
};

export default function S3Dashboard() {
  const [rawFiles, setRawFiles] = useState<string[]>([]);
  const [files, setFiles] = useState<S3File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { logout, loggedIn } = useAuth();

  const pageSize = 5;

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSize,
  });

  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "name",
      desc: false,
    },
  ]);

  const [rowSelection, setRowSelection] = useState({});

  const fetchFiles = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/s3/list");
      const data = await res.json();
      if (res.ok) {
        setRawFiles(data.files || []);
        // Transform raw file names into structured data for the table
        const formattedFiles = (data.files || []).map((filename: string) => {
          return {
            id: filename,
            name: filename,
            lastModified: new Date().toISOString(), // Placeholder, actual data would come from S3 metadata
            size: 0, // Placeholder, actual data would come from S3 metadata
            type: filename.split('.').pop() || "",
          };
        });
        setFiles(formattedFiles);
      } else {
        setError(data.message || "Failed to fetch files");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDownload = async (filename: string) => {
    window.location.href = `/api/s3/download?filename=${encodeURIComponent(filename)}`;
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/s3/delete?filename=${encodeURIComponent(filename)}`, { method: "DELETE" });
      if (res.ok) {
        fetchFiles();
      } else {
        const data = await res.json();
        setError(data.message || "Delete failed");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        fetchFiles();
        setSelectedFile(null);
      } else {
        const data = await res.json();
        setError(data.message || "Upload failed");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setUploading(false);
    }
  };

  const handleBulkDelete = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const fileNames = selectedRows.map(row => row.original.name);
    if (!confirm(`Delete ${fileNames.length} selected file(s)?`)) return;

    setLoading(true);
    try {
      // In a real implementation, you might want to use Promise.all to delete multiple files in parallel
      for (const fileName of fileNames) {
        await fetch(`/api/s3/delete?filename=${encodeURIComponent(fileName)}`, { method: "DELETE" });
      }
      fetchFiles();
      setRowSelection({});
    } catch (err) {
      setError("Network error during bulk delete");
    } finally {
      setLoading(false);
    }
  };

  // Define columns for the table
  const columns: ColumnDef<S3File>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      size: 28,
      enableSorting: false,
    },
    {
      header: "File Name",
      accessorKey: "name",
      cell: ({ row }) => <div className="font-medium break-all">{row.getValue("name")}</div>,
      size: 180,
    },
    {
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => (
        <Badge>
          {row.getValue("type")}
        </Badge>
      ),
      size: 120,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const file = row.original;
        return (
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(file.name)}
              disabled={!loggedIn}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(file.name)}
              disabled={!loggedIn}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
      size: 120,
    },
  ];

  const table = useReactTable({
    data: files,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      pagination,
      rowSelection,
    },
  });

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage: table.getState().pagination.pageIndex + 1,
    totalPages: table.getPageCount() || 1,
    paginationItemsToDisplay: 5,
  });

  return (
    <div className="max-w-4xl mx-auto p-6 bg-background rounded-lg shadow-md flex flex-col gap-6 min-h-[80vh] mt-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">S3 File Manager</h2>
        <Button
          variant="outline"
          onClick={() => {
            logout();
            // No need to manually redirect as the dashboard page will handle it
          }}
          type="button"
        >
          Logout
        </Button>
      </div>

      <div className="space-y-4">
        <form onSubmit={handleUpload} className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full border rounded p-2"
              disabled={!loggedIn || uploading}
            />
          </div>
          <Button
            type="submit"
            disabled={uploading || !selectedFile || !loggedIn}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload File"}
          </Button>
          {Object.keys(rowSelection).length > 0 && (
            <Button
              variant="destructive"
              type="button"
              onClick={handleBulkDelete}
              disabled={!loggedIn}
              className="ml-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          )}
        </form>

        {error && <div className="text-destructive text-sm">{error}</div>}

        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <Table className="table-fixed">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead
                          key={header.id}
                          style={{ width: `${header.getSize()}px` }}
                          className="h-11"
                        >
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <div
                              className={cn(
                                header.column.getCanSort() &&
                                  "flex h-full cursor-pointer select-none items-center justify-between gap-2",
                              )}
                              onClick={header.column.getToggleSortingHandler()}
                              onKeyDown={(e) => {
                                if (
                                  header.column.getCanSort() &&
                                  (e.key === "Enter" || e.key === " ")
                                ) {
                                  e.preventDefault();
                                  header.column.getToggleSortingHandler()?.(e);
                                }
                              }}
                              tabIndex={header.column.getCanSort() ? 0 : undefined}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {{
                                asc: (
                                  <ChevronUp
                                    className="shrink-0 opacity-60"
                                    size={16}
                                    strokeWidth={2}
                                    aria-hidden="true"
                                  />
                                ),
                                desc: (
                                  <ChevronDown
                                    className="shrink-0 opacity-60"
                                    size={16}
                                    strokeWidth={2}
                                    aria-hidden="true"
                                  />
                                ),
                              }[header.column.getIsSorted() as string] ?? null}
                            </div>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      Loading files...
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No files found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-3 max-sm:flex-col">
            {/* Page number information */}
            <p className="flex-1 whitespace-nowrap text-sm text-muted-foreground" aria-live="polite">
              Page <span className="text-foreground">{table.getState().pagination.pageIndex + 1}</span>{" "}
              of <span className="text-foreground">{table.getPageCount() || 1}</span>
            </p>

            {/* Pagination buttons */}
            <div className="grow">
              <Pagination>
                <PaginationContent>
                  {/* Previous page button */}
                  <PaginationItem>
                    <Button
                      size="icon"
                      variant="outline"
                      className="disabled:pointer-events-none disabled:opacity-50"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      aria-label="Go to previous page"
                    >
                      <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                    </Button>
                  </PaginationItem>

                  {/* Left ellipsis (...) */}
                  {showLeftEllipsis && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  {/* Page number buttons */}
                  {pages.map((page) => {
                    const isActive = page === table.getState().pagination.pageIndex + 1;
                    return (
                      <PaginationItem key={page}>
                        <Button
                          size="icon"
                          variant={`${isActive ? "outline" : "ghost"}`}
                          onClick={() => table.setPageIndex(page - 1)}
                          aria-current={isActive ? "page" : undefined}
                        >
                          {page}
                        </Button>
                      </PaginationItem>
                    );
                  })}

                  {/* Right ellipsis (...) */}
                  {showRightEllipsis && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  {/* Next page button */}
                  <PaginationItem>
                    <Button
                      size="icon"
                      variant="outline"
                      className="disabled:pointer-events-none disabled:opacity-50"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                      aria-label="Go to next page"
                    >
                      <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>

            {/* Results per page */}
            <div className="flex flex-1 justify-end">
              <Select
                value={table.getState().pagination.pageSize.toString()}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
                aria-label="Results per page"
              >
                <SelectTrigger id="results-per-page" className="w-fit whitespace-nowrap">
                  <SelectValue placeholder="Select number of results" />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 25, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={pageSize.toString()}>
                      {pageSize} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
