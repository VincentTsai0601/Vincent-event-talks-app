import os
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import re
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Mock fallback data for when the live feed is rate-limited (HTTP 429) or offline
MOCK_RELEASES = [
    {
        "id": "tag:google.com,2026:bigquery-release-notes-2026-06-18",
        "title": "BigQuery release notes: June 18, 2026",
        "date": "2026-06-18",
        "link": "https://cloud.google.com/bigquery/docs/release-notes#June_18_2026",
        "updates": [
            {
                "type": "Feature",
                "badge": "Beta",
                "category": "Vector Search",
                "content_html": "<strong>Feature (Beta)</strong>: Added native vector index support for HNSW (Hierarchical Navigable Small World) to speed up high-dimensional vector similarity searches. This enables much faster querying for Retrieval-Augmented Generation (RAG) and recommendation systems directly inside BigQuery.",
                "content_text": "Feature (Beta): Added native vector index support for HNSW (Hierarchical Navigable Small World) to speed up high-dimensional vector similarity searches. This enables much faster querying for Retrieval-Augmented Generation (RAG) and recommendation systems directly inside BigQuery."
            },
            {
                "type": "Fix",
                "badge": "Fix",
                "category": "Query Optimizer",
                "content_html": "<strong>Fix</strong>: Resolved an issue where query optimization failed for specific complex query plan nested loops when joining tables partitioned by time unit columns. Query execution times for these joins have been restored to baseline.",
                "content_text": "Fix: Resolved an issue where query optimization failed for specific complex query plan nested loops when joining tables partitioned by time unit columns. Query execution times for these joins have been restored to baseline."
            }
        ]
    },
    {
        "id": "tag:google.com,2026:bigquery-release-notes-2026-05-12",
        "title": "BigQuery release notes: May 12, 2026",
        "date": "2026-05-12",
        "link": "https://cloud.google.com/bigquery/docs/release-notes#May_12_2026",
        "updates": [
            {
                "type": "Feature",
                "badge": "GA",
                "category": "BigQuery ML",
                "content_html": "<strong>Feature (GA)</strong>: Pre-trained <strong>TimesFM</strong> models are now generally available in BigQuery ML. You can use these models to perform zero-shot time-series forecasting on your business metrics, directly using SQL queries or connected worksheets.",
                "content_text": "Feature (GA): Pre-trained TimesFM models are now generally available in BigQuery ML. You can use these models to perform zero-shot time-series forecasting on your business metrics, directly using SQL queries or connected worksheets."
            },
            {
                "type": "Change",
                "badge": "Change",
                "category": "Billing",
                "content_html": "<strong>Change</strong>: Updated reservation slot billing granularity to second-by-second increments, replacing the previous minute-by-minute system. This change helps optimize costs for bursty query workloads.",
                "content_text": "Change: Updated reservation slot billing granularity to second-by-second increments, replacing the previous minute-by-minute system. This change helps optimize costs for bursty query workloads."
            }
        ]
    },
    {
        "id": "tag:google.com,2026:bigquery-release-notes-2026-04-28",
        "title": "BigQuery release notes: April 28, 2026",
        "date": "2026-04-28",
        "link": "https://cloud.google.com/bigquery/docs/release-notes#April_28_2026",
        "updates": [
            {
                "type": "Feature",
                "badge": "Beta",
                "category": "Generative AI",
                "content_html": "<strong>Feature (Beta)</strong>: Gemini Cloud Assist integration in the SQL workspace console is now in public preview. This provides inline SQL generation, query explanation, and troubleshooting suggestions directly within the console text editor.",
                "content_text": "Feature (Beta): Gemini Cloud Assist integration in the SQL workspace console is now in public preview. This provides inline SQL generation, query explanation, and troubleshooting suggestions directly within the console text editor."
            },
            {
                "type": "Deprecation",
                "badge": "Deprecation",
                "category": "BI Engine",
                "content_html": "<strong>Deprecation</strong>: The legacy BigQuery BI Engine reservation API version 1 is now deprecated and will be retired on December 31, 2026. Migrating to reservation API version 2 is recommended.",
                "content_text": "Deprecation: The legacy BigQuery BI Engine reservation API version 1 is now deprecated and will be retired on December 31, 2026. Migrating to reservation API version 2 is recommended."
            }
        ]
    },
    {
        "id": "tag:google.com,2026:bigquery-release-notes-2026-03-15",
        "title": "BigQuery release notes: March 15, 2026",
        "date": "2026-03-15",
        "link": "https://cloud.google.com/bigquery/docs/release-notes#March_15_2026",
        "updates": [
            {
                "type": "Feature",
                "badge": "GA",
                "category": "Governance",
                "content_html": "<strong>Feature (GA)</strong>: BigQuery Data Lineage is now generally available. This feature automatically tracks and displays the lineage of your datasets and tables, showing data progression visually in the Google Cloud Console.",
                "content_text": "Feature (GA): BigQuery Data Lineage is now generally available. This feature automatically tracks and displays the lineage of your datasets and tables, showing data progression visually in the Google Cloud Console."
            },
            {
                "type": "Fix",
                "badge": "Fix",
                "category": "IAM & Security",
                "content_html": "<strong>Fix</strong>: Fixed a bug where exporting table metadata to Cloud Logging would fail with credentials errors for specific cross-project service accounts.",
                "content_text": "Fix: Fixed a bug where exporting table metadata to Cloud Logging would fail with credentials errors for specific cross-project service accounts."
            }
        ]
    },
    {
        "id": "tag:google.com,2026:bigquery-release-notes-2026-02-10",
        "title": "BigQuery release notes: February 10, 2026",
        "date": "2026-02-10",
        "link": "https://cloud.google.com/bigquery/docs/release-notes#February_10_2026",
        "updates": [
            {
                "type": "Feature",
                "badge": "GA",
                "category": "Storage",
                "content_html": "<strong>Feature (GA)</strong>: Support for Apache Iceberg v2 table format is now fully operational in external table queries. This allows users to query and merge Iceberg v2 transactional tables without performance degradation.",
                "content_text": "Feature (GA): Support for Apache Iceberg v2 table format is now fully operational in external table queries. This allows users to query and merge Iceberg v2 transactional tables without performance degradation."
            },
            {
                "type": "Feature",
                "badge": "Beta",
                "category": "Performance",
                "content_html": "<strong>Feature (Beta)</strong>: Added query history optimization recommendations. The recommendation engine now analyzes your query history and highlights queries that could achieve >30% cost savings through partitioning or clustering.",
                "content_text": "Feature (Beta): Added query history optimization recommendations. The recommendation engine now analyzes your query history and highlights queries that could achieve >30% cost savings through partitioning or clustering."
            }
        ]
    },
    {
        "id": "tag:google.com,2026:bigquery-release-notes-2026-01-15",
        "title": "BigQuery release notes: January 15, 2026",
        "date": "2026-01-15",
        "link": "https://cloud.google.com/bigquery/docs/release-notes#January_15_2026",
        "updates": [
            {
                "type": "Feature",
                "badge": "GA",
                "category": "Object Tables",
                "content_html": "<strong>Feature (GA)</strong>: Object tables for unstructured data now support metadata caching. This enables sub-second query performance when searching through petabyte-scale image, video, and audio metadata on Cloud Storage.",
                "content_text": "Feature (GA): Object tables for unstructured data now support metadata caching. This enables sub-second query performance when searching through petabyte-scale image, video, and audio metadata on Cloud Storage."
            },
            {
                "type": "Fix",
                "badge": "Fix",
                "category": "API",
                "content_html": "<strong>Fix</strong>: Resolved a bug causing long load times and connection timeouts in the `datasets.list` API when querying projects containing more than 50,000 datasets.",
                "content_text": "Fix: Resolved a bug causing long load times and connection timeouts in the `datasets.list` API when querying projects containing more than 50,000 datasets."
            }
        ]
    },
    {
        "id": "tag:google.com,2025:bigquery-release-notes-2025-12-05",
        "title": "BigQuery release notes: December 05, 2025",
        "date": "2025-12-05",
        "link": "https://cloud.google.com/bigquery/docs/release-notes#December_05_2025",
        "updates": [
            {
                "type": "Feature",
                "badge": "GA",
                "category": "BigQuery ML",
                "content_html": "<strong>Feature (GA)</strong>: BigQuery ML now supports training and deployment of XGBoost version 1.7 models, providing access to optimized gradient boosting algorithms with lower memory footprints.",
                "content_text": "Feature (GA): BigQuery ML now supports training and deployment of XGBoost version 1.7 models, providing access to optimized gradient boosting algorithms with lower memory footprints."
            },
            {
                "type": "Change",
                "badge": "Change",
                "category": "Migration",
                "content_html": "<strong>Change</strong>: BigQuery Migration Service now requires a Cloud Billing account for new projects and SQL translation tasks, aligning it with other enterprise migration tools.",
                "content_text": "Change: BigQuery Migration Service now requires a Cloud Billing account for new projects and SQL translation tasks, aligning it with other enterprise migration tools."
            }
        ]
    },
    {
        "id": "tag:google.com,2025:bigquery-release-notes-2025-11-14",
        "title": "BigQuery release notes: November 14, 2025",
        "date": "2025-11-14",
        "link": "https://cloud.google.com/bigquery/docs/release-notes#November_14_2025",
        "updates": [
            {
                "type": "Feature",
                "badge": "Beta",
                "category": "Search",
                "content_html": "<strong>Feature (Beta)</strong>: Added search index support on JSON columns. This allows for rapid keyword searches within complex, nested JSON schemas, dramatically reducing query times for log analytics.",
                "content_text": "Feature (Beta): Added search index support on JSON columns. This allows for rapid keyword searches within complex, nested JSON schemas, dramatically reducing query times for log analytics."
            }
        ]
    }
]

# A helper list of common categories to match in updates
CATEGORIES = [
    "Vector Search", "Query Optimizer", "BigQuery ML", "Billing", "Generative AI", 
    "BI Engine", "Governance", "IAM & Security", "Storage", "Performance", 
    "Object Tables", "API", "Migration", "Search", "Partitioning", "Clustering",
    "SQL Dialect", "Data Governance", "Materialized Views", "Analytics"
]

def categorize_update(content_text):
    """Attempt to assign a category based on keywords in text"""
    content_lower = content_text.lower()
    for cat in CATEGORIES:
        if cat.lower() in content_lower:
            return cat
    return "General"

def parse_release_item(content_html):
    """
    Parses the HTML content of a single Atom feed entry, splits it into 
    distinct update bullet points/paragraphs, and categorizes them.
    """
    soup = BeautifulSoup(content_html, 'html.parser')
    
    # We will search for list items or paragraphs representing distinct changes.
    updates = []
    
    # Google release notes often structure changes in list items (li) or paragraphs (p)
    items = soup.find_all('li')
    if not items:
        # If no list items, let's look for paragraphs
        items = soup.find_all('p')
        
    if not items:
        # Fallback to the entire content
        text = soup.get_text().strip()
        if text:
            category = categorize_update(text)
            updates.append({
                "type": "General",
                "badge": "Info",
                "category": category,
                "content_html": content_html,
                "content_text": text
            })
        return updates
        
    for item in items:
        text = item.get_text().strip()
        if not text:
            continue
            
        # Detect type of update (Feature, Fix, Change, Deprecation, etc.)
        # Often starts with "Feature", "Fix", "Deprecation", "Change", "Note", "General availability" etc.
        update_type = "General"
        badge = "Info"
        
        # Check for standard prefixes
        strong_tag = item.find(['strong', 'b'])
        prefix = ""
        if strong_tag:
            prefix = strong_tag.get_text().strip().lower()
            
        text_lower = text.lower()
        
        if "feature" in prefix or text_lower.startswith("feature"):
            update_type = "Feature"
            badge = "GA" if "ga" in text_lower or "generally available" in text_lower else "Beta"
        elif "fix" in prefix or text_lower.startswith("fix"):
            update_type = "Fix"
            badge = "Fix"
        elif "change" in prefix or text_lower.startswith("change"):
            update_type = "Change"
            badge = "Change"
        elif "deprecation" in prefix or text_lower.startswith("deprecation"):
            update_type = "Deprecation"
            badge = "Deprecation"
        elif "note" in prefix or text_lower.startswith("note"):
            update_type = "Note"
            badge = "Note"
        elif "beta" in text_lower:
            update_type = "Feature"
            badge = "Beta"
        elif "generally available" in text_lower or "general availability" in text_lower or " ga " in text_lower:
            update_type = "Feature"
            badge = "GA"
            
        category = categorize_update(text)
        
        updates.append({
            "type": update_type,
            "badge": badge,
            "category": category,
            "content_html": str(item),
            "content_text": text
        })
        
    return updates

def parse_xml_feed(xml_data):
    """Parses Atom feed XML data into structured releases"""
    # Atom namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError as e:
        print("XML Parse Error:", e)
        return None
        
    releases = []
    
    # In Atom feeds, each update is inside an <entry> tag
    for entry in root.findall('atom:entry', ns):
        entry_id = entry.find('atom:id', ns)
        entry_id = entry_id.text if entry_id is not None else ""
        
        title_el = entry.find('atom:title', ns)
        title = title_el.text if title_el is not None else "BigQuery Release Update"
        
        # Extract date from title or updated tag
        # Title is often in format "BigQuery release notes: June 30, 2026"
        # Updated is often in ISO format "2026-06-30T10:00:00Z"
        updated_el = entry.find('atom:updated', ns)
        updated_date_str = updated_el.text if updated_el is not None else ""
        
        published_el = entry.find('atom:published', ns)
        published_date_str = published_el.text if published_el is not None else ""
        
        date_str = ""
        if published_date_str:
            date_str = published_date_str[:10]
        elif updated_date_str:
            date_str = updated_date_str[:10]
        else:
            # Fallback parsing date from title
            match = re.search(r'([A-Za-z]+ \d{1,2}, \d{4})', title)
            if match:
                date_str = match.group(1)
                
        link_el = entry.find("atom:link[@rel='alternate']", ns)
        if link_el is None:
            link_el = entry.find("atom:link", ns)
        link = link_el.attrib.get('href', '') if link_el is not None else ""
        
        # Get content
        content_el = entry.find('atom:content', ns)
        if content_el is None:
            content_el = entry.find('atom:summary', ns)
            
        content_html = content_el.text if content_el is not None else ""
        
        updates = parse_release_item(content_html)
        
        releases.append({
            "id": entry_id,
            "title": title,
            "date": date_str,
            "link": link,
            "updates": updates
        })
        
    # Sort releases by date descending
    releases.sort(key=lambda x: x.get('date', ''), reverse=True)
    return releases

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    url = "https://cloud.google.com/feeds/bigquery-release-notes.xml"
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    xml_data = None
    source = "live"
    is_cached = False
    
    # Try fetching the live feed
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        # Set a short timeout so the UI doesn't hang if Google is unresponsive
        with urllib.request.urlopen(req, timeout=8) as response:
            if response.status == 200:
                xml_data = response.read()
                print("Live feed fetched successfully.")
            else:
                print(f"Failed to fetch live feed. Status code: {response.status}")
    except Exception as e:
        print(f"Error fetching live feed: {str(e)}")
        
    releases = None
    if xml_data:
        try:
            releases = parse_xml_feed(xml_data)
        except Exception as e:
            print(f"Error parsing live XML: {str(e)}")
            
    if not releases:
        print("Using local mock fallback dataset.")
        releases = MOCK_RELEASES
        source = "fallback"
        is_cached = True
        
    return jsonify({
        "status": "success",
        "source": source,
        "is_cached": is_cached,
        "count": len(releases),
        "releases": releases
    })

if __name__ == '__main__':
    # Run server on port 5000
    app.run(debug=True, port=5000)
