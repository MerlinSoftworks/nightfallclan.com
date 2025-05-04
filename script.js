// Simple script to handle sticky headers
document.addEventListener('DOMContentLoaded', function() {
  const headers = document.querySelectorAll('h2');
  const headerHeight = headers[0]?.offsetHeight || 46; // Approximate header height
  
  window.addEventListener('scroll', function() {
    // Get the current scroll position
    const scrollPosition = window.scrollY;
    
    // Track which header is active
    let activeHeaderIndex = -1;
    
    // First pass: determine which header should be active based on position
    headers.forEach((header, index) => {
      // Get position of the header
      const headerTop = header.offsetTop;
      const trueTop = header.getBoundingClientRect().top;
      
      // We need to add an offset to prevent overlap
      // When the next header is headerHeight pixels from the top, we should switch
      const triggerPoint = scrollPosition + headerHeight;
      
      // If this header's top position is below the trigger point, it shouldn't be sticky yet
      if (headerTop > triggerPoint) {
        header.classList.remove('sticky');
      } else {
        // This header should be sticky
        header.classList.add('sticky');
        activeHeaderIndex = Math.max(activeHeaderIndex, index);
      }

      if (trueTop === 0) { header.classList.add('stuck') } else if (trueTop > 80) { header.classList.remove('stuck') }
    });
    
    // Second pass: adjust visibility based on active header
    headers.forEach((header, index) => {
      if (index < activeHeaderIndex) {
        // Push previous headers completely out of view
        header.style.transform = 'translateY(-100%)';
      } else {
        // Keep current and future headers visible
        header.style.transform = '';
      }
    });
  });
  
  // Trigger scroll event once on load to set initial state
  window.dispatchEvent(new Event('scroll'));
});
