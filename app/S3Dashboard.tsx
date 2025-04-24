"use client";

import { useEffect, useState, useRef } from "react";
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
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Folder, FolderOpen, ArrowLeft, Trash2, Upload, File as FileIcon } from "lucide-react";

type S3Item = {
  id: string;
  name: string;
  fullPath: string;
  lastModified?: string;
  size?: number;
  type: "file" | "folder";
};

export default function S3Dashboard() {
  const [items, setItems] = useState<S3Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [breadcrumbs, setBreadcrumbs] = useState<{name: string, path: string}[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);
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

  const fetchItems = async (path = "") => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/s3/list?folderPath=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setCurrentPath(data.currentPath || "");

        // Update breadcrumbs
        const pathParts = path.split('/');
        const crumbs = [{ name: "Home", path: "" }];

        let currentPathAccumulator = "";
        for (let i = 0; i < pathParts.length; i++) {
          if (pathParts[i]) {
            currentPathAccumulator += (currentPathAccumulator ? "/" : "") + pathParts[i];
            crumbs.push({
              name: pathParts[i],
              path: currentPathAccumulator
            });
          }
        }

        setBreadcrumbs(crumbs);
      } else {
        setError(data.message || "Failed to fetch items");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDownload = async (item: S3Item) => {
    if (item.type === "file") {
      window.location.href = `/api/s3/download?path=${encodeURIComponent(item.fullPath)}&type=file`;
    } else {
      window.location.href = `/api/s3/download?path=${encodeURIComponent(item.fullPath)}&type=folder`;
    }
  };

  const handleFolderClick = (folderPath: string) => {
    // Remove trailing slash if present for consistent navigation
    const normalizedPath = folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath;
    fetchItems(normalizedPath);
  };

  const handleBreadcrumbClick = (path: string) => {
    fetchItems(path);
  };

  const handleDelete = async (item: S3Item) => {
    if (!confirm(`Delete ${item.name}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/s3/delete?path=${encodeURIComponent(item.fullPath)}&type=${item.type}`, { method: "DELETE" });
      if (res.ok) {
        fetchItems(currentPath);
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
      formData.append("currentPath", currentPath);
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        fetchItems(currentPath);
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

  const createFolder = async () => {
    const folderName = prompt("Enter folder name:");
    if (!folderName) return;

    setLoading(true);
    setError("");

    try {
      // Create an empty file with a special name to represent the folder
      const formData = new FormData();
      // Create an empty file
      const emptyFile = new File([""], ".folder", { type: "text/plain" });
      formData.append("file", emptyFile);
      formData.append("currentPath", currentPath ? `${currentPath}/${folderName}` : folderName);
      formData.append("createFolder", "true");

      const res = await fetch("/api/s3/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        fetchItems(currentPath);
      } else {
        const data = await res.json();
        setError(data.message || "Failed to create folder");
      }
    } catch (err) {
      setError("Network error during folder creation");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUploadToFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    // Prompt for folder name
    const folderName = prompt("Enter folder name for these files:");
    if (!folderName) return;

    setUploading(true);
    setError("");

    try {
      const files = Array.from(e.target.files);

      // Upload each file to the specified folder
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("currentPath", currentPath ? `${currentPath}/${folderName}` : folderName);

        const res = await fetch("/api/s3/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message || `Failed to upload ${file.name}`);
          break;
        }
      }

      // Refresh the file list
      fetchItems(currentPath);

      // Reset the file input
      if (e.target.value) {
        e.target.value = "";
      }
    } catch (err) {
      setError("Network error during upload");
    } finally {
      setUploading(false);
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    setError("");

    try {
      const files = Array.from(e.target.files);
      let hasWebkitRelativePath = false;

      // First check if we have proper folder structure
      for (const file of files) {
        if ((file as any).webkitRelativePath) {
          hasWebkitRelativePath = true;
          break;
        }
      }

      // If we don't have proper folder structure, use the alternative method
      if (!hasWebkitRelativePath) {
        setUploading(false);
        return handleFileUploadToFolder(e);
      }

      // Process files with folder structure
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("currentPath", currentPath);
        formData.append("preservePath", "true");
        formData.append("webkitRelativePath", (file as any).webkitRelativePath || "");

        const res = await fetch("/api/s3/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message || `Failed to upload ${file.name}`);
          break;
        }
      }

      // Refresh the file list
      fetchItems(currentPath);

      // Reset the file input
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }
    } catch (err) {
      setError("Network error during folder upload");
    } finally {
      setUploading(false);
    }
  };

  const handleBulkDelete = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const selectedItems = selectedRows.map(row => row.original);
    if (!confirm(`Delete ${selectedItems.length} selected item(s)?`)) return;

    setLoading(true);
    try {
      // In a real implementation, you might want to use Promise.all to delete multiple files in parallel
      for (const item of selectedItems) {
        await fetch(`/api/s3/delete?path=${encodeURIComponent(item.fullPath)}&type=${item.type}`, { method: "DELETE" });
      }
      fetchItems(currentPath);
      setRowSelection({});
    } catch (err) {
      setError("Network error during bulk delete");
    } finally {
      setLoading(false);
    }
  };

  // Define columns for the table
  const columns: ColumnDef<S3Item>[] = [
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
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="font-medium break-all flex items-center gap-2">
            {item.type === "folder" ? (
              <>
                <FolderOpen className="h-4 w-4 text-blue-500" />
                <span
                  className="cursor-pointer hover:underline text-blue-600"
                  onClick={() => handleFolderClick(item.fullPath)}
                >
                  {item.name}
                </span>
              </>
            ) : (
              <>
                <FileIcon className="h-4 w-4 text-gray-500" />
                <span>{item.name}</span>
              </>
            )}
          </div>
        );
      },
      size: 180,
    },
    {
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => (
        <Badge className={row.original.type === "folder" ? "bg-blue-100 text-blue-800" : ""}>
          {row.getValue("type")}
        </Badge>
      ),
      size: 120,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(item)}
              disabled={!loggedIn}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(item)}
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
    data: items,
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
        <div>
          <h2 className="text-2xl font-bold">S3 File Manager</h2>
          {/* Breadcrumb navigation */}
          <div className="flex items-center text-sm text-gray-600 mt-2">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex items-center">
                {index > 0 && <span className="mx-2">/</span>}
                <button
                  onClick={() => handleBreadcrumbClick(crumb.path)}
                  className="hover:underline hover:text-blue-600"
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        </div>
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
        <div className="flex flex-wrap gap-3 items-start">
          {/* Unified upload interface */}
          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full border rounded p-2"
                  disabled={!loggedIn || uploading}
                />
              </div>
              <Button
                type="button"
                onClick={() => {
                  if (selectedFile) {
                    handleUpload(new Event('submit') as any);
                  }
                }}
                disabled={uploading || !selectedFile || !loggedIn}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload File"}
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 flex gap-2">
                <Button
                  type="button"
                  onClick={createFolder}
                  disabled={uploading || !loggedIn}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Folder className="h-4 w-4" />
                  New Folder
                </Button>

                <Button
                  type="button"
                  onClick={() => {
                    // Create a file input that accepts folders
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    // @ts-ignore
                    input.webkitdirectory = true;
                    // @ts-ignore
                    input.directory = true;

                    // Handle the file selection
                    input.onchange = (e) => handleFolderUpload(e as any);

                    // Trigger the file dialog
                    input.click();
                  }}
                  disabled={uploading || !loggedIn}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Folder className="h-4 w-4" />
                  Upload Folder
                </Button>

                {/* <Button
                  type="button"
                  onClick={() => {
                    // Create a file input that accepts multiple files
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;

                    // Handle the file selection
                    input.onchange = (e) => handleFileUploadToFolder(e as any);

                    // Trigger the file dialog
                    input.click();
                  }}
                  disabled={uploading || !loggedIn}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload to Folder
                </Button> */}
              </div>
            </div>
          </div>

          {/* Hidden inputs for folder upload */}
          <div className="hidden">
            <input
              ref={folderInputRef}
              type="file"
              // @ts-ignore - webkitdirectory is not in the standard HTML attributes but is supported by browsers
              webkitdirectory=""
              // @ts-ignore - directory is not in the standard HTML attributes but is supported by browsers
              directory=""
              multiple
              onChange={handleFolderUpload}
              disabled={!loggedIn || uploading}
            />
          </div>

          {/* Bulk delete button */}
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
        </div>

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
