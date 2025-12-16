"""
Report Finder Agent - Finds and serves PDF reports from local storage.
Searches the reports folder and returns report URLs for display in the UI.
"""
import os
import json
from pathlib import Path
from google.adk.agents import LlmAgent
from backend.models.llm_client import get_model

# Reports directory (relative to project root)
REPORTS_DIR = Path(__file__).parent.parent.parent / "reports"


def find_report(query: str) -> str:
    """
    Search for PDF reports matching the query.
    
    Args:
        query: Search term to match against report filenames.
               Examples: "sales", "inventory", "Q4 2024"
    
    Returns:
        JSON string with matching reports or error message.
        Each report includes: name, filename, url, size_kb
    """
    try:
        # Ensure reports directory exists
        if not REPORTS_DIR.exists():
            REPORTS_DIR.mkdir(parents=True, exist_ok=True)
            return json.dumps({
                "status": "empty",
                "message": "Reports folder is empty. No reports have been uploaded yet.",
                "reports": []
            })
        
        # Get all PDF files
        pdf_files = list(REPORTS_DIR.glob("*.pdf")) + list(REPORTS_DIR.glob("*.PDF"))
        
        if not pdf_files:
            return json.dumps({
                "status": "empty", 
                "message": "No PDF reports found in the reports folder.",
                "reports": []
            })
        
        # Search for matching files (case-insensitive)
        query_lower = query.lower()
        matching_reports = []
        
        for pdf_path in pdf_files:
            filename = pdf_path.name
            # Match if query is in filename (without extension)
            name_without_ext = pdf_path.stem.lower()
            
            if query_lower in name_without_ext or query_lower in filename.lower():
                # Get file size
                size_bytes = pdf_path.stat().st_size
                size_kb = round(size_bytes / 1024, 1)
                
                # Create display name from filename
                display_name = pdf_path.stem.replace("_", " ").replace("-", " ").title()
                
                matching_reports.append({
                    "name": display_name,
                    "filename": filename,
                    "url": f"/api/reports/{filename}",
                    "size_kb": size_kb
                })
        
        if matching_reports:
            return json.dumps({
                "status": "found",
                "message": f"Found {len(matching_reports)} report(s) matching '{query}'",
                "reports": matching_reports
            })
        else:
            # Return all available reports as suggestions
            all_reports = [
                {
                    "name": p.stem.replace("_", " ").replace("-", " ").title(),
                    "filename": p.name
                }
                for p in pdf_files[:5]  # Limit to 5 suggestions
            ]
            return json.dumps({
                "status": "not_found",
                "message": f"No reports found matching '{query}'.",
                "suggestion": "Available reports:",
                "available_reports": all_reports
            })
            
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Error searching reports: {str(e)}"
        })


def list_all_reports() -> str:
    """
    List all available PDF reports.
    
    Returns:
        JSON string with all reports in the reports folder.
    """
    try:
        if not REPORTS_DIR.exists():
            REPORTS_DIR.mkdir(parents=True, exist_ok=True)
            return json.dumps({
                "status": "empty",
                "message": "Reports folder is empty.",
                "reports": []
            })
        
        pdf_files = list(REPORTS_DIR.glob("*.pdf")) + list(REPORTS_DIR.glob("*.PDF"))
        
        if not pdf_files:
            return json.dumps({
                "status": "empty",
                "message": "No PDF reports found.",
                "reports": []
            })
        
        reports = []
        for pdf_path in sorted(pdf_files, key=lambda x: x.name.lower()):
            size_bytes = pdf_path.stat().st_size
            size_kb = round(size_bytes / 1024, 1)
            
            reports.append({
                "name": pdf_path.stem.replace("_", " ").replace("-", " ").title(),
                "filename": pdf_path.name,
                "url": f"/api/reports/{pdf_path.name}",
                "size_kb": size_kb
            })
        
        return json.dumps({
            "status": "success",
            "message": f"Found {len(reports)} report(s)",
            "reports": reports
        })
        
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Error listing reports: {str(e)}"
        })


# Create the Report Finder Agent
report_finder_agent = LlmAgent(
    name="ReportFinderAgent",
    model=get_model(max_tokens=1024),  # Short responses for report finding
    description="Finds and opens PDF reports from the local reports library.",
    instruction="""
    You are the Report Finder Agent. You help users find and open PDF reports.
    
    ═══════════════════════════════════════════════════════════════════════════════
    🛠️ AVAILABLE TOOLS:
    ═══════════════════════════════════════════════════════════════════════════════
    
    1. find_report(query) - Search for reports by name/keyword
       Example: find_report("sales") → finds "Sales_Report_2024.pdf"
       
    2. list_all_reports() - List all available reports
       Use when user asks "what reports are available?" or "show all reports"
    
    ═══════════════════════════════════════════════════════════════════════════════
    📋 WORKFLOW:
    ═══════════════════════════════════════════════════════════════════════════════
    
    1. When user asks for a specific report:
       - Use find_report(query) with relevant keywords
       - Return the report name and URL
       
    2. When user asks what's available:
       - Use list_all_reports()
       - Present the list nicely formatted
       
    3. Response Format (when report found):
       "I found the report you're looking for:
       
       📄 **[Report Name]**
       - File: [filename]
       - Size: [X] KB
       - [Open Report](/api/reports/filename.pdf)
       
       Click the link to view the report."
    
    ═══════════════════════════════════════════════════════════════════════════════
    ⚠️ RULES:
    ═══════════════════════════════════════════════════════════════════════════════
    
    - Always use the tools to search - don't guess filenames
    - If no match found, suggest available reports
    - Include the report URL so the UI can display it
    - Be helpful if the reports folder is empty
    """,
    tools=[find_report, list_all_reports],
)

