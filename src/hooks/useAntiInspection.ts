
'use client';

import { useEffect } from 'react';

export function useAntiInspection() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // F12
      if (event.key === 'F12') {
        event.preventDefault();
      }

      // Ctrl+Shift+I (or Cmd+Opt+I on Mac) - Inspect Element
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toUpperCase() === 'I') {
        event.preventDefault();
      }

      // Ctrl+Shift+C (or Cmd+Opt+C on Mac) - Inspect Element (alternative shortcut, common in Firefox)
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toUpperCase() === 'C') {
        event.preventDefault();
      }

      // Ctrl+Shift+J (or Cmd+Opt+J on Mac) - Developer Console
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toUpperCase() === 'J') {
        event.preventDefault();
      }

      // Ctrl+U (or Cmd+U on Mac) - View Source
      if ((event.ctrlKey || event.metaKey) && event.key.toUpperCase() === 'U') {
        event.preventDefault();
      }

      // Ctrl+S (or Cmd+S on Mac) - Save Page (often blocked in such scenarios)
      if ((event.ctrlKey || event.metaKey) && event.key.toUpperCase() === 'S') {
        event.preventDefault();
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    // This is a more aggressive technique that can detect if dev tools are opened.
    // It works by checking the execution time of the `debugger` statement.
    // If dev tools are open, the `debugger` statement will pause execution,
    // and the time difference will be significant.
    // This is generally not recommended as it's intrusive.
    // const devToolsChecker = () => {
    //   const threshold = 160; // milliseconds
    //   let isOpen = false;
    //   const check = () => {
    //     const startTime = performance.now();
    //     // This line will only pause execution if dev tools are open
    //     // eslint-disable-next-line no-debugger
    //     debugger;
    //     const endTime = performance.now();
    //     if (endTime - startTime > threshold) {
    //       if (!isOpen) {
    //         // console.warn("Developer tools detected! Closing or redirecting.");
    //         // Add actions here, e.g., redirect or blank out page
    //         // document.body.innerHTML = "Inspection is not allowed."; 
    //       }
    //       isOpen = true;
    //     } else {
    //       isOpen = false;
    //     }
    //   };
    //   // Periodically check
    //   // setInterval(check, 1000); // This can be performance intensive
    // };
    // devToolsChecker();


    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);
}
