// DOM Helper Functions - Standardized Vanilla DOM API Usage
// ES6 module - automatically in strict mode

/**
 * Create an element with attributes and children using vanilla DOM API
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Element attributes
 * @param {Array} children - Child elements or text nodes
 * @returns {HTMLElement}
 */
export function createElement(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);
  
  // Set attributes using setAttribute for consistency
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key.startsWith('on')) {
        // Event handlers
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else if (key === 'style' && typeof value === 'object') {
        // Handle style object
        Object.assign(element.style, value);
      } else {
        element.setAttribute(key, value);
      }
    }
  }
  
  // Add children
  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }
  
  return element;
}

/**
 * Create an SVG element with proper namespace
 * @param {string} tag - SVG element tag name
 * @param {Object} attributes - Element attributes
 * @returns {SVGElement}
 */
export function createSVGElement(tag, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) {
      element.setAttribute(key, String(value));
    }
  }
  
  return element;
}

/**
 * Query selector with error handling
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (default: document)
 * @returns {Element|null}
 */
export function querySelector(selector, parent = document) {
  try {
    return parent.querySelector(selector);
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return null;
  }
}

/**
 * Query selector all with error handling
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (default: document)
 * @returns {NodeList}
 */
export function querySelectorAll(selector, parent = document) {
  try {
    return parent.querySelectorAll(selector);
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return [];
  }
}

/**
 * Add event listener with error handling
 * @param {Element} element - Target element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {Object} options - Event listener options
 */
export function addEventListener(element, event, handler, options = {}) {
  try {
    if (!element || !event || !handler) {
      throw new Error('Invalid parameters for addEventListener');
    }
    element.addEventListener(event, handler, options);
  } catch (error) {
    console.error('Failed to add event listener:', error);
  }
}

/**
 * Remove event listener with error handling
 * @param {Element} element - Target element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {Object} options - Event listener options
 */
export function removeEventListener(element, event, handler, options = {}) {
  try {
    if (!element || !event || !handler) {
      throw new Error('Invalid parameters for removeEventListener');
    }
    element.removeEventListener(event, handler, options);
  } catch (error) {
    console.error('Failed to remove event listener:', error);
  }
}

/**
 * Set multiple attributes at once
 * @param {Element} element - Target element
 * @param {Object} attributes - Attributes to set
 */
export function setAttributes(element, attributes) {
  try {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== null && value !== undefined) {
        element.setAttribute(key, String(value));
      }
    }
  } catch (error) {
    console.error('Failed to set attributes:', error);
  }
}

/**
 * Add CSS classes with error handling
 * @param {Element} element - Target element
 * @param {...string} classes - Class names to add
 */
export function addClass(element, ...classes) {
  try {
    if (!element || !element.classList) {
      throw new Error('Invalid element for addClass');
    }
    element.classList.add(...classes);
  } catch (error) {
    console.error('Failed to add classes:', error);
  }
}

/**
 * Remove CSS classes with error handling
 * @param {Element} element - Target element
 * @param {...string} classes - Class names to remove
 */
export function removeClass(element, ...classes) {
  try {
    if (!element || !element.classList) {
      throw new Error('Invalid element for removeClass');
    }
    element.classList.remove(...classes);
  } catch (error) {
    console.error('Failed to remove classes:', error);
  }
}

/**
 * Toggle CSS class with error handling
 * @param {Element} element - Target element
 * @param {string} className - Class name to toggle
 * @param {boolean} force - Force add/remove
 * @returns {boolean} - Whether class is present after toggle
 */
export function toggleClass(element, className, force) {
  try {
    if (!element || !element.classList) {
      throw new Error('Invalid element for toggleClass');
    }
    return element.classList.toggle(className, force);
  } catch (error) {
    console.error('Failed to toggle class:', error);
    return false;
  }
}

/**
 * Clear all children from an element
 * @param {Element} element - Target element
 */
export function clearChildren(element) {
  try {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  } catch (error) {
    console.error('Failed to clear children:', error);
  }
}

/**
 * Insert element after reference element
 * @param {Element} newElement - Element to insert
 * @param {Element} referenceElement - Reference element
 */
export function insertAfter(newElement, referenceElement) {
  try {
    const parent = referenceElement.parentNode;
    if (referenceElement.nextSibling) {
      parent.insertBefore(newElement, referenceElement.nextSibling);
    } else {
      parent.appendChild(newElement);
    }
  } catch (error) {
    console.error('Failed to insert element after:', error);
  }
}

/**
 * Get element by ID with error handling
 * @param {string} id - Element ID
 * @returns {Element|null}
 */
export function getElementById(id) {
  try {
    return document.getElementById(id);
  } catch (error) {
    console.error(`Failed to get element by ID: ${id}`, error);
    return null;
  }
}

// Export all functions as default object as well
export default {
  createElement,
  createSVGElement,
  querySelector,
  querySelectorAll,
  addEventListener,
  removeEventListener,
  setAttributes,
  addClass,
  removeClass,
  toggleClass,
  clearChildren,
  insertAfter,
  getElementById
};