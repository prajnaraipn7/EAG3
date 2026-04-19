let GEMINI_API_KEY = "";
let GEMINI_API_URL = "";
let currentResults = [];

async function loadEnv() {
  try {
    const response = await fetch(chrome.runtime.getURL('.env'));
    const text = await response.text();

    // Parse .env line by line
    const lines = text.split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      if (key && key.trim() === 'GEMINI_API_KEY') {
        const value = valueParts.join('=').trim();
        // Remove quotes if present
        GEMINI_API_KEY = value.replace(/^["']|["']$/g, '');
        GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
        break;
      }
    }

    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not found in .env file");

  } catch (error) {
    console.error("Config load error:", error);
    const resultsContainer = document.getElementById('results');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <p style="color: #ef4444;">⚠️ Configuration Error</p>
          <p style="font-size: 0.8rem;">Please ensure a <b>.env</b> file exists with your <b>GEMINI_API_KEY</b>.</p>
        </div>`;
    }
  }
}

const configPromise = loadEnv();

document.getElementById('searchBtn').addEventListener('click', performSearch);
document.getElementById('productInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performSearch();
});

document.getElementById('downloadBtn').addEventListener('click', downloadReport);

async function performSearch() {
  await configPromise;
  const query = document.getElementById('productInput').value.trim();
  if (!query) return;

  const resultsContainer = document.getElementById('results');
  const loader = document.getElementById('loader');
  const downloadBtn = document.getElementById('downloadBtn');

  resultsContainer.innerHTML = '';
  loader.style.display = 'block';
  downloadBtn.style.display = 'none';
  currentResults = [];

  try {
    // 1. Ask Gemini to provide price comparison data
    // We prompt Gemini to "act" as a search agent that knows typical prices or can estimate based on its training.
    // Ideally, for real-time data, we would use a more complex scraping setup, but for this extension,
    // we'll leverage Gemini's structured output.

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Search the live web for the following product: "${query}". 
            Find exact product prices and direct URLs on Amazon.in, Flipkart,Myntra and Nykaa.
            
            Return your findings ONLY as a JSON array of objects with keys: "platform", "name", "price", "link", and "image_url".
            
            STRICT RULES:
            1. CATEGORY MATCH: Only include results that belong to the SAME category as the input (e.g., if searching for a 'racket', do NOT return clothing).
            2. EXACT PRODUCT: The product returned must be an exact match for "${query}". No "similar" or "related" items.
            3. STOCK CHECK: ONLY include products that are currently IN STOCK. If you see "Out of Stock" or "Sold Out", omit it.
            4. VERIFIED LINKS: Ensure the link leads directly to that product.
            
            Return ONLY the raw JSON array. If nothing exact and in-stock is found, return [].`
          }]
        }],
        tools: [{
          google_search: {}
        }]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}: Failed to reach Gemini API`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Unknown Gemini API Error");
    }

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
      throw new Error("No response from Gemini. Try a different search term.");
    }

    // Safely extract text from the first part that contains it
    const parts = data.candidates[0].content.parts || [];
    let text = "";
    for (const part of parts) {
      if (part.text) {
        text += part.text;
      }
    }

    if (!text) {
      throw new Error("Gemini returned an empty response. This might be due to safety filters.");
    }

    // Manual JSON extraction from potential markdown or text wrapping
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1) {
      text = text.substring(firstBracket, lastBracket + 1);
    }

    try {
      let products = JSON.parse(text);

      // Clean grounding-api-redirect URLs if they appear
      products = products.map(p => {
        if (p.link && p.link.includes('grounding-api-redirect')) {
          // Extracts the actual URL from after the comma or within the string
          const parts = p.link.split(',');
          const actualLink = parts.find(part => part.trim().startsWith('http'));
          if (actualLink) {
            p.link = actualLink.trim();
          }
        }
        return p;
      });

      loader.style.display = 'none';

      if (products && products.length > 0) {
        currentResults = products;
        document.getElementById('downloadBtn').style.display = 'block';
        products.forEach(product => {
          const card = createProductCard(product);
          resultsContainer.appendChild(card);
        });
      } else {
        resultsContainer.innerHTML = '<div class="empty-state">No exact matches found for this product.</div>';
      }
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Raw Text:", text);
      throw new Error("Failed to parse product data. The AI response was malformed.");
    }

  } catch (error) {
    console.error('Search failed:', error);
    loader.style.display = 'none';
    resultsContainer.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
  }
}

function createProductCard(product) {
  const div = document.createElement('div');
  div.className = 'product-card';

  const imgSrc = product.image_url || 'https://via.placeholder.com/60';

  div.innerHTML = `
    <img src="${imgSrc}" class="product-img" alt="${product.name}">
    <div class="product-info">
      <div class="product-platform">${product.platform}</div>
      <div class="product-name">${product.name}</div>
      <div class="product-price">₹${product.price}</div>
    </div>
    <div style="display: flex; align-items: center;">
      <button class="view-btn">View</button>
    </div>
  `;

  // Fallback for image loading errors (replaces the inline onerror)
  const img = div.querySelector('.product-img');
  img.addEventListener('error', () => {
    img.src = 'https://via.placeholder.com/60';
  });

  // Make the whole card clickable
  div.addEventListener('click', (e) => {
    e.preventDefault();
    if (product.link) {
      chrome.tabs.create({ url: product.link });
    }
  });

  return div;
}

function downloadReport() {
  if (currentResults.length === 0) return;

  const query = document.getElementById('productInput').value.trim();
  let content = `PRICE SCOUT - SEARCH RESULTS FOR: ${query.toUpperCase()}\n`;
  content += `Generated on: ${new Date().toLocaleString()}\n`;
  content += `--------------------------------------------------\n\n`;

  currentResults.forEach((product, index) => {
    content += `${index + 1}. ${product.name}\n`;
    content += `   Platform: ${product.platform}\n`;
    content += `   Price   : ₹${product.price}\n`;
    content += `   Link    : ${product.link}\n`;
    content += `\n`;
  });

  content += `--------------------------------------------------\n`;
  content += `Thank you for using Price Scout!`;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `price_report_${query.replace(/\s+/g, '_').toLowerCase()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
