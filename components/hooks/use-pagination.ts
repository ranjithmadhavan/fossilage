import { useMemo } from "react";

interface UsePaginationProps {
  currentPage: number;
  totalPages: number;
  paginationItemsToDisplay?: number;
}

export function usePagination({
  currentPage,
  totalPages,
  paginationItemsToDisplay = 5,
}: UsePaginationProps) {
  const pages = useMemo(() => {
    // If we have less than or equal to the number of pagination items to display,
    // just return all pages
    if (totalPages <= paginationItemsToDisplay) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Half of the items to display (rounded down)
    const halfItems = Math.floor(paginationItemsToDisplay / 2);

    // Basic algorithm to display pagination items
    let startPage = Math.max(currentPage - halfItems, 1);
    let endPage = Math.min(startPage + paginationItemsToDisplay - 1, totalPages);

    // If we're at the end, we want to show the last `paginationItemsToDisplay` pages
    if (endPage === totalPages) {
      startPage = Math.max(endPage - paginationItemsToDisplay + 1, 1);
    }

    // If we're at the start, we want to show the first `paginationItemsToDisplay` pages
    if (startPage === 1) {
      endPage = Math.min(paginationItemsToDisplay, totalPages);
    }

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, i) => startPage + i
    );
  }, [currentPage, totalPages, paginationItemsToDisplay]);

  // Determine if we should show ellipses
  const showLeftEllipsis = useMemo(
    () => pages.length > 0 && pages[0] > 1,
    [pages]
  );

  const showRightEllipsis = useMemo(
    () => pages.length > 0 && pages[pages.length - 1] < totalPages,
    [pages, totalPages]
  );

  return {
    pages,
    showLeftEllipsis,
    showRightEllipsis,
  };
}
