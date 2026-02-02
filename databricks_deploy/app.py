
"""
SIMPLIFIED RAG CHATBOT - SERVES REACT UI FROM BUILD
"""
import os
import requests
from flask import Flask, send_from_directory, send_file, request, jsonify, session
from databricks.vector_search.client import VectorSearchClient
from datetime import datetime
from pathlib import Path

# ====================== CONFIGURATION ======================
DATABRICKS_HOST = os.environ.get("DATABRICKS_HOST", "adb-5948147112231195.15.azuredatabricks.net")
DATABRICKS_TOKEN = os.environ.get("DATABRICKS_TOKEN", "YOUR_TOKEN_HERE")

VS_ENDPOINT_NAME = "vectoreserachforpbuagent"
VS_INDEX_NAME = "data_internal_ds.genie_demo.ragpbiindex_semntic"
# LLM_ENDPOINT = "gpt_41_endpoint"
# LLM_ENDPOINT ="databricks-meta-llama-3-3-70b-instruct"
LLM_ENDPOINT ="databricks-claude-sonnet-4"

os.environ['DATABRICKS_HOST'] = f"https://{DATABRICKS_HOST}"
os.environ['DATABRICKS_TOKEN'] = DATABRICKS_TOKEN

print("="*60)
print(" PowerBI Beacon Chatbot Starting...")
print("="*60)

# ====================== INITIALIZE ======================
try:
    vs_client = VectorSearchClient(disable_notice=True)
    vs_index = vs_client.get_index(endpoint_name=VS_ENDPOINT_NAME, index_name=VS_INDEX_NAME)
    print("✅ Vector Search connected")
except Exception as e:
    print(f"❌ Vector Search error: {e}")
    vs_index = None

llm_url = f"https://{DATABRICKS_HOST}/serving-endpoints/{LLM_ENDPOINT}/invocations"
llm_headers = {
    'Authorization': f'Bearer {DATABRICKS_TOKEN}',
    'Content-Type': 'application/json'
}

# ====================== SIMPLE CONVERSATION MEMORY ======================
class SimpleMemory:
    def __init__(self):
        self.conversations = {}
    
    def add_turn(self, session_id: str, question: str, answer: str):
        if session_id not in self.conversations:
            self.conversations[session_id] = []
        
        self.conversations[session_id].append({
            "question": question,
            "answer": answer
        })
        
        # Keep only last 3 turns
        if len(self.conversations[session_id]) > 3:
            self.conversations[session_id] = self.conversations[session_id][-3:]
    
    def get_context(self, session_id: str) -> str:
        history = self.conversations.get(session_id, [])
        if not history:
            return ""
        
        context = "Previous conversation:\n"
        for turn in history[-2:]:  # Last 2 turns only
            context += f"Q: {turn['question']}\nA: {turn['answer'][:200]}...\n\n"
        return context
    
    def clear(self, session_id: str):
        if session_id in self.conversations:
            del self.conversations[session_id]

memory = SimpleMemory()

# ====================== SIMPLE OBSERVABILITY TRACKER ======================
class SimpleObservability:
    """Simple in-memory observability tracker for Databricks"""
    def __init__(self):
        self.requests = []
        self.max_requests = 1000  # Keep last 1000 requests
    
    def calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> tuple:
        """
        Calculate cost based on model pricing.
        Returns: (total_cost, input_cost, output_cost) in USD
        """
        # Model pricing per 1M tokens (Updated January 2026)
        # Sources: https://www.cloudidr.com/llm-pricing, https://llmpricingcalculator.com/
        # Content rephrased for compliance with licensing restrictions
        pricing = {
            # ===== OPENAI MODELS =====
            "gpt-5": {"input": 1.25, "output": 10.0},  # GPT-5 flagship
            "gpt-5.2": {"input": 1.25, "output": 10.0},  # GPT-5.2 latest
            "gpt-5-nano": {"input": 0.05, "output": 0.40},  # GPT-5 nano (fast/cheap)
            "gpt-5-mini": {"input": 0.25, "output": 2.0},  # GPT-5 mini
            "gpt-4.1": {"input": 2.0, "output": 8.0},  # GPT-4.1 flagship
            "gpt-4.1-nano": {"input": 0.05, "output": 0.20},  # GPT-4.1 nano (fastest)
            "gpt-4.1-mini": {"input": 0.40, "output": 1.60},  # GPT-4.1 mini
            "gpt-4o": {"input": 3.0, "output": 6.0},  # GPT-4o with audio
            "gpt-4o-mini": {"input": 0.15, "output": 0.60},  # GPT-4o mini (best value)
            "gpt-4o-audio-preview": {"input": 3.0, "output": 6.0},  # GPT-4o audio
            "gpt-4o-mini-tts": {"input": 0.60, "output": 12.0},  # Text-to-speech
            "o3": {"input": 10.0, "output": 40.0},  # o3 reasoning model
            "o3-mini": {"input": 1.10, "output": 4.40},  # o3-mini reasoning
            "o4-mini": {"input": 1.10, "output": 4.40},  # o4-mini reasoning
            "gpt_41_endpoint": {"input": 2.0, "output": 8.0},  # GPT-4.1 endpoint alias
            
            # ===== ANTHROPIC CLAUDE MODELS =====
            # Note: databricks-claude-* models use same pricing as regular Claude models
            "claude-opus-4": {"input": 15.0, "output": 75.0},  # Claude Opus 4 (most capable)
            "claude-opus-4.5": {"input": 5.0, "output": 25.0},  # Claude Opus 4.5
            "claude-opus-4-20250514": {"input": 15.0, "output": 75.0},  # Claude Opus 4 dated
            "claude-3-opus": {"input": 15.0, "output": 75.0},  # Claude 3 Opus
            "claude-sonnet-4": {"input": 3.0, "output": 15.0},  # Claude Sonnet 4 (balanced)
            "claude-sonnet-4.5": {"input": 3.0, "output": 15.0},  # Claude Sonnet 4.5
            "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},  # Claude Sonnet 4 dated
            "claude-3.5-sonnet": {"input": 3.0, "output": 15.0},  # Claude 3.5 Sonnet
            "claude-3.7-sonnet": {"input": 3.0, "output": 15.0},  # Claude 3.7 Sonnet (reasoning)
            "claude-haiku-4.5": {"input": 1.0, "output": 5.0},  # Claude Haiku 4.5 (fastest, 1/3 cost of Sonnet)
            "claude-3.5-haiku": {"input": 0.80, "output": 4.0},  # Claude 3.5 Haiku
            "databricks-claude-sonnet-4": {"input": 3.0, "output": 15.0},  # Same as claude-sonnet-4
            "databricks-claude-haiku-4.5": {"input": 1.0, "output": 5.0},  # Same as claude-haiku-4.5
            
            # ===== GOOGLE GEMINI MODELS =====
            "gemini-3-pro": {"input": 1.25, "output": 10.0},  # Gemini 3 Pro
            "gemini-3-flash": {"input": 0.50, "output": 2.50},  # Gemini 3 Flash (3x faster)
            "gemini-2.5-pro": {"input": 1.25, "output": 10.0},  # Gemini 2.5 Pro
            "gemini-2.5-pro-preview": {"input": 1.25, "output": 10.0},  # Gemini 2.5 Pro preview
            "gemini-2.5-flash-preview": {"input": 0.15, "output": 0.60},  # Gemini 2.5 Flash (reasoning)
            "gemini-2.0-flash": {"input": 0.10, "output": 0.40},  # Gemini 2.0 Flash (balanced)
            "gemini-2.0-flash-lite": {"input": 0.08, "output": 0.30},  # Gemini 2.0 Flash Lite (cheapest)
            "gemini-1.5-flash": {"input": 0.08, "output": 0.30},  # Gemini 1.5 Flash (proven)
            
            # ===== META LLAMA MODELS =====
            "llama-4-scout-17b": {"input": 0.27, "output": 0.85},  # Llama 4 Scout (multimodal)
            "llama-3.1-405b": {"input": 8.0, "output": 24.0},  # Llama 3.1 405B (largest)
            "llama-3.1-70b": {"input": 3.50, "output": 10.50},  # Llama 3.1 70B
            "llama-3.1-8b": {"input": 0.45, "output": 0.70},  # Llama 3.1 8B (compact)
            "llama-3.3-70b": {"input": 0.65, "output": 0.65},  # Llama 3.3 70B
            "databricks-meta-llama-3-3-70b-instruct": {"input": 0.65, "output": 0.65},  # Databricks Llama 3.3 70B
            
            # ===== DEEPSEEK MODELS =====
            "deepseek-r1": {"input": 1.35, "output": 5.40},  # DeepSeek-R1 (reasoning)
            
            # ===== XAI GROK MODELS =====
            "grok-4": {"input": 0.20, "output": 0.50},  # Grok 4 Fast (low-cost)
            "grok-4-fast": {"input": 0.20, "output": 0.50},  # Grok 4 Fast
            "grok-4.1": {"input": 0.20, "output": 0.50},  # Grok 4.1
            
            # ===== MISTRAL MODELS =====
            "mistral-small-3.1-24b": {"input": 0.35, "output": 0.56},  # Mistral Small 3.1 (vision)
            
            # ===== GOOGLE GEMMA MODELS =====
            "gemma-3-12b": {"input": 0.35, "output": 0.56},  # Gemma 3 12B (multimodal)
            
            # ===== REASONING MODELS =====
            "qwq-32b": {"input": 0.66, "output": 1.0},  # QwQ-32B (reasoning)
        }
        
        # Get pricing for model with smart extraction
        model_key = model.lower()
        
        # Try exact match first
        if model_key in pricing:
            pricing_data = pricing[model_key]
        else:
            # Extract model name from endpoint name by looking for known model identifiers
            # Examples: "gpt_41_endpoint" -> "gpt-4.1", "my_claude_sonnet" -> "claude-sonnet-4"
            pricing_data = None
            
            # Check for model name patterns in the endpoint name
            model_patterns = {
                # OpenAI patterns
                'gpt-5': ['gpt5', 'gpt-5', 'gpt_5'],
                'gpt-4.1': ['gpt41', 'gpt-41', 'gpt_41', 'gpt4.1'],
                'gpt-4o': ['gpt4o', 'gpt-4o', 'gpt_4o'],
                'o3': ['o3', 'o-3', 'o_3'],
                'o4': ['o4', 'o-4', 'o_4'],
                # Claude patterns
                'claude-opus-4': ['opus4', 'opus-4', 'opus_4', 'claude-opus-4'],
                'claude-sonnet-4': ['sonnet4', 'sonnet-4', 'sonnet_4', 'claude-sonnet-4', 'claude4'],
                'claude-haiku-4.5': ['haiku45', 'haiku-45', 'haiku_45', 'haiku4.5'],
                'claude-3.5-sonnet': ['claude35', 'claude-35', 'claude_35', 'sonnet35'],
                'claude-3.5-haiku': ['haiku35', 'haiku-35', 'haiku_35'],
                # Gemini patterns
                'gemini-3': ['gemini3', 'gemini-3', 'gemini_3'],
                'gemini-2.5': ['gemini25', 'gemini-25', 'gemini_25', 'gemini2.5'],
                'gemini-2.0': ['gemini20', 'gemini-20', 'gemini_20', 'gemini2.0'],
                'gemini-1.5': ['gemini15', 'gemini-15', 'gemini_15', 'gemini1.5'],
                # Llama patterns
                'llama-4': ['llama4', 'llama-4', 'llama_4'],
                'llama-3.3-70b': ['llama33', 'llama-33', 'llama_33', 'llama3.3', 'llama-3-3-70b'],
                'llama-3.1-405b': ['llama31-405', 'llama-31-405', 'llama_31_405', 'llama3.1-405'],
                'llama-3.1-70b': ['llama31-70', 'llama-31-70', 'llama_31_70', 'llama3.1-70'],
                'llama-3.1-8b': ['llama31-8', 'llama-31-8', 'llama_31_8', 'llama3.1-8'],
                # Other patterns
                'deepseek-r1': ['deepseek', 'deepseek-r1', 'deepseek_r1'],
                'grok-4': ['grok4', 'grok-4', 'grok_4'],
                'mistral': ['mistral'],
            }
            
            # Try to match patterns
            for model_name, patterns in model_patterns.items():
                for pattern in patterns:
                    if pattern in model_key:
                        if model_name in pricing:
                            pricing_data = pricing[model_name]
                            print(f"[Pricing] Matched endpoint '{model}' to model '{model_name}' via pattern '{pattern}'")
                            break
                if pricing_data:
                    break
            
            # If still no match, try partial matching on pricing keys
            if not pricing_data:
                for key in pricing.keys():
                    # Check if any part of the pricing key is in the endpoint name
                    key_parts = key.replace('-', ' ').replace('_', ' ').split()
                    for part in key_parts:
                        if len(part) > 3 and part in model_key:  # Only match meaningful parts (>3 chars)
                            pricing_data = pricing[key]
                            print(f"[Pricing] Matched endpoint '{model}' to model '{key}' via partial match '{part}'")
                            break
                    if pricing_data:
                        break
            
            # Final fallback: default to Claude Sonnet 4 pricing
            if not pricing_data:
                pricing_data = pricing["claude-sonnet-4"]
                print(f"[Pricing] ⚠️ No match found for '{model}', using default Claude Sonnet 4 pricing")
        
        input_cost = (input_tokens / 1_000_000) * pricing_data["input"]
        output_cost = (output_tokens / 1_000_000) * pricing_data["output"]
        total_cost = input_cost + output_cost
        
        print(f"[Observability] Cost calculation for {model}: {input_tokens} in / {output_tokens} out")
        print(f"[Observability] Costs: ${input_cost:.6f} in / ${output_cost:.6f} out / ${total_cost:.6f} total")
        
        return (total_cost, input_cost, output_cost)
    
    def track_request(self, model: str, input_tokens: int, output_tokens: int, 
                     latency_ms: float, success: bool, error: str = None,
                     user_id: str = None, session_id: str = None):
        """Track an LLM request"""
        try:
            from datetime import datetime
            
            total_tokens = input_tokens + output_tokens
            
            # Calculate cost using proper pricing
            total_cost, input_cost, output_cost = self.calculate_cost(model, input_tokens, output_tokens)
            
            request_data = {
                "timestamp": datetime.now().isoformat(),
                "model": model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "cost": total_cost,
                "input_cost": input_cost,
                "output_cost": output_cost,
                "latency_ms": latency_ms,
                "success": success,
                "error": error,
                "user_id": user_id,
                "session_id": session_id,
                "agent_name": "databricks_rag"
            }
            
            self.requests.append(request_data)
            
            # Debug logging
            print(f"[Observability] ✅ Tracked request: {model} | {input_tokens} in / {output_tokens} out | ${total_cost:.6f} | {latency_ms:.0f}ms | success={success}")
            print(f"[Observability] Total requests in memory: {len(self.requests)}")
            
            # Keep only recent requests
            if len(self.requests) > self.max_requests:
                self.requests = self.requests[-self.max_requests:]
        except Exception as e:
            print(f"[Observability] ❌ ERROR tracking request: {e}")
            import traceback
            traceback.print_exc()
    
    def get_stats(self):
        """Get comprehensive observability statistics"""
        if not self.requests:
            return {
                "summary": {
                    "total_requests": 0,
                    "successful_requests": 0,
                    "failed_requests": 0,
                    "success_rate": 0,
                    "total_tokens_input": 0,
                    "total_tokens_output": 0,
                    "total_tokens": 0,
                    "total_cost_usd": 0,
                    "input_cost_usd": 0,
                    "output_cost_usd": 0,
                    "average_latency_ms": 0
                },
                "by_model": {},
                "hourly_breakdown": [],
                "recent_requests": []
            }
        
        from collections import defaultdict
        from datetime import datetime
        
        # Summary stats
        total = len(self.requests)
        successful = sum(1 for r in self.requests if r["success"])
        failed = total - successful
        success_rate = (successful / total * 100) if total > 0 else 0
        
        total_input = sum(r["input_tokens"] for r in self.requests)
        total_output = sum(r["output_tokens"] for r in self.requests)
        total_tokens = total_input + total_output
        total_cost = sum(r["cost"] for r in self.requests)
        input_cost = sum(r["input_cost"] for r in self.requests)
        output_cost = sum(r["output_cost"] for r in self.requests)
        avg_latency = sum(r["latency_ms"] for r in self.requests) / total if total > 0 else 0
        
        # By model stats - format must match React app expectations
        by_model = defaultdict(lambda: {
            "requests": 0,
            "tokens_input": 0,
            "tokens_output": 0,
            "tokens_total": 0,
            "cost_usd": 0.0,
            "input_cost_usd": 0.0,
            "output_cost_usd": 0.0,
            "average_latency_ms": 0.0,
            "success_rate": 0.0
        })
        
        for r in self.requests:
            model = r["model"]
            by_model[model]["requests"] += 1
            by_model[model]["tokens_input"] += r["input_tokens"]
            by_model[model]["tokens_output"] += r["output_tokens"]
            by_model[model]["tokens_total"] += r["total_tokens"]
            by_model[model]["cost_usd"] += r["cost"]
            by_model[model]["input_cost_usd"] += r["input_cost"]
            by_model[model]["output_cost_usd"] += r["output_cost"]
            by_model[model]["average_latency_ms"] += r["latency_ms"]
        
        # Calculate averages and success rates per model
        by_model_result = {}
        for model, stats in by_model.items():
            count = stats["requests"]
            avg_latency = stats["average_latency_ms"] / count if count > 0 else 0.0
            model_successful = sum(1 for r in self.requests if r["model"] == model and r["success"])
            success_rate = (model_successful / count * 100) if count > 0 else 0.0
            
            by_model_result[model] = {
                "requests": stats["requests"],
                "tokens_input": stats["tokens_input"],
                "tokens_output": stats["tokens_output"],
                "tokens_total": stats["tokens_total"],
                "cost_usd": round(stats["cost_usd"], 4),
                "input_cost_usd": round(stats["input_cost_usd"], 4),
                "output_cost_usd": round(stats["output_cost_usd"], 4),
                "average_latency_ms": round(avg_latency, 2),
                "success_rate": round(success_rate, 2)
            }
        
        # Hourly breakdown (last 24 hours) - match Local version format
        from datetime import timedelta
        hourly_data = []
        now = datetime.now()
        
        # Create hourly buckets for last 24 hours (even if empty)
        for i in range(24):
            hour_start = now - timedelta(hours=i+1)
            hour_end = now - timedelta(hours=i)
            
            # Find requests in this hour
            hour_requests = []
            for r in self.requests:
                try:
                    req_time = datetime.fromisoformat(r["timestamp"].replace('Z', '+00:00'))
                    if hour_start <= req_time < hour_end:
                        hour_requests.append(r)
                except:
                    pass
            
            hourly_data.append({
                "hour": hour_start.strftime("%Y-%m-%d %H:00"),
                "requests": len(hour_requests),
                "cost": sum(r["cost"] for r in hour_requests)
            })
        
        # Reverse to show most recent first (like Local version)
        hourly_breakdown = list(reversed(hourly_data))
        
        return {
            "summary": {
                "total_requests": total,
                "successful_requests": successful,
                "failed_requests": failed,
                "success_rate": round(success_rate, 2),
                "total_tokens_input": total_input,
                "total_tokens_output": total_output,
                "total_tokens": total_tokens,
                "total_cost_usd": round(total_cost, 4),
                "input_cost_usd": round(input_cost, 4),
                "output_cost_usd": round(output_cost, 4),
                "average_latency_ms": round(avg_latency, 2)
            },
            "by_model": by_model_result,
            "hourly_breakdown": hourly_breakdown,
            "recent_requests": sorted(self.requests, key=lambda r: r["timestamp"], reverse=True)[:50]  # Most recent first, limit 50
        }
    
    def reset(self):
        """Reset all observability data"""
        self.requests = []

observability = SimpleObservability()

# ====================== SIMPLIFIED SEARCH ======================
def simple_search(question: str, top_k: int = 20):
    """
    FLEXIBLE SEARCH LOGIC:
    1. Search vector index
    2. Get MORE results (20 instead of 8)
    3. Query source table to get full metadata
    4. Return all chunks with available metadata
    """
    if vs_index is None:
        print("❌ Vector index is None!")
        return []
    
    try:
        print(f"🔍 Searching for: '{question}'")
        
        # Do vector search - get IDs and text
        # The index has primary_key='id', so we should be able to get it
        results = vs_index.similarity_search(
            query_text=question,
            num_results=top_k,
            columns=["text", "id"]  # Try to get ID to query source table
        )
        
        # Extract data
        data_array = results.get("result", {}).get("data_array", [])
        if not data_array:
            data_array = results.get("data_array", [])
        
        columns = results.get("result", {}).get("column_names", [])
        if not columns:
            columns = results.get("manifest", {}).get("columns", [])
            if columns:
                columns = [c.get("name") for c in columns]
        
        # Fallback: if no columns found, assume basic schema
        if not columns:
            columns = ["text", "filename", "file_path", "file_type"]
        
        print(f"📊 Found {len(data_array)} results with columns: {columns}")
        
        if not data_array:
            print("⚠️ No data returned!")
            return []
        
        # Try to get metadata from source table
        # Source table: data_internal_ds.genie_demo.ragpbi_chunks
        print("🔍 Querying source table for available columns and metadata...")
        
        # Query source table via SQL API to get metadata
        metadata_map = {}
        source_columns = []
        try:
            # First, get a sample to see what columns exist
            sql_query = """
            SELECT * 
            FROM data_internal_ds.genie_demo.ragpbi_chunks 
            LIMIT 100
            """
            
            sql_url = f"https://{DATABRICKS_HOST}/api/2.0/sql/statements"
            sql_payload = {
                "statement": sql_query,
                "warehouse_id": "auto",  # Use serverless SQL
                "wait_timeout": "30s"
            }
            sql_headers = {
                'Authorization': f'Bearer {DATABRICKS_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            sql_response = requests.post(sql_url, headers=sql_headers, json=sql_payload, timeout=35)
            
            if sql_response.status_code == 200:
                sql_result = sql_response.json()
                if sql_result.get("status", {}).get("state") == "SUCCEEDED":
                    result_data = sql_result.get("result", {}).get("data_array", [])
                    source_columns = [col["name"] for col in sql_result.get("manifest", {}).get("schema", {}).get("columns", [])]
                    
                    print(f"✅ Source table columns: {source_columns}")
                    print(f"✅ Fetched {len(result_data)} sample rows from source table")
                    
                    # Build metadata map: text -> metadata
                    for row in result_data:
                        row_dict = dict(zip(source_columns, row))
                        text_key = str(row_dict.get("text", ""))[:500]
                        
                        # Find filename column (try common names)
                        filename = (
                            row_dict.get("filename") or
                            row_dict.get("file_name") or
                            row_dict.get("name") or
                            row_dict.get("source") or
                            row_dict.get("document") or
                            "unknown"
                        )
                        
                        # Find path column
                        file_path = (
                            row_dict.get("file_path") or
                            row_dict.get("path") or
                            row_dict.get("filepath") or
                            row_dict.get("source_path") or
                            row_dict.get("url") or
                            ""
                        )
                        
                        # Find type column
                        file_type = (
                            row_dict.get("file_type") or
                            row_dict.get("type") or
                            row_dict.get("doc_type") or
                            row_dict.get("extension") or
                            "document"
                        )
                        
                        metadata_map[text_key] = {
                            "filename": str(filename),
                            "file_path": str(file_path),
                            "file_type": str(file_type),
                            "all_columns": row_dict  # Store all for debugging
                        }
                    
                    print(f"✅ Built metadata map with {len(metadata_map)} entries")
                else:
                    print(f"⚠️ SQL query not succeeded: {sql_result.get('status', {})}")
            else:
                print(f"⚠️ SQL API error: {sql_response.status_code} - {sql_response.text[:200]}")
        except Exception as e:
            print(f"⚠️ Could not fetch metadata from source table: {e}")
            import traceback
            traceback.print_exc()
        
        # Flexible extraction - handle any schema
        chunks = []
        for idx, row in enumerate(data_array):
            try:
                # Convert to dict
                if isinstance(row, dict):
                    chunk_dict = row
                elif isinstance(row, (list, tuple)):
                    chunk_dict = dict(zip(columns, row))
                else:
                    continue
                
                # Extract text (required field)
                text = str(chunk_dict.get("text", ""))
                if not text or len(text.strip()) < 10:
                    continue
                
                # Try to get metadata from source table first
                text_key = text[:500]
                if text_key in metadata_map:
                    metadata = metadata_map[text_key]
                    filename = metadata["filename"]
                    file_path = metadata["file_path"]
                    file_type = metadata["file_type"]
                    print(f"  ✅ Found metadata from source table for chunk {idx+1}")
                else:
                    # Fallback: Extract from chunk_dict (will be "unknown")
                    filename = (
                        chunk_dict.get("filename") or 
                        chunk_dict.get("file_name") or 
                        chunk_dict.get("name") or 
                        chunk_dict.get("source") or 
                        "unknown"
                    )
                    
                    file_path = (
                        chunk_dict.get("file_path") or 
                        chunk_dict.get("path") or 
                        chunk_dict.get("filepath") or 
                        chunk_dict.get("source_path") or 
                        ""
                    )
                    
                    file_type = chunk_dict.get("file_type") or chunk_dict.get("type") or "document"
                
                chunks.append({
                    "text": text,
                    "filename": str(filename),
                    "file_path": str(file_path),
                    "file_type": str(file_type)
                })
                
                if idx < 3:
                    print(f"  ✅ Chunk {idx+1}: {filename} ({file_type}) - {len(text)} chars")
            
            except Exception as e:
                print(f"  ⚠️ Skipping row {idx}: {e}")
                continue
        
        print(f"✅ Returning {len(chunks)} chunks")
        return chunks
        
    except Exception as e:
        print(f"❌ Search error: {e}")
        import traceback
        traceback.print_exc()
        return []

# ====================== SIMPLE CONTEXT BUILDER ======================
def build_simple_context(chunks: list) -> tuple:
    """
    SIMPLE LOGIC:
    1. Take ALL chunks (up to 15)
    2. Combine them with labels
    3. Return context and sources
    """
    if not chunks:
        return "", []
    
    context_parts = []
    sources_list = []
    seen_files = set()
    
    # Use more chunks for complete data
    for i, chunk in enumerate(chunks[:15]):
        filename = chunk["filename"]
        text = chunk["text"]
        
        # Add to context with clear labeling
        context_parts.append(f"""
=== SOURCE {i+1}: {filename} ===
{text}
==========================================
""")
        
        # Track sources
        if filename not in seen_files:
            sources_list.append({
                "filename": filename,
                "path": chunk["file_path"],
                "type": chunk["file_type"],
                "is_table": False,
                "chunks_used": 1
            })
            seen_files.add(filename)
        else:
            for s in sources_list:
                if s["filename"] == filename:
                    s["chunks_used"] += 1
                    break
    
    context = "\n".join(context_parts)
    print(f"📄 Context: {len(context)} chars from {len(sources_list)} files")
    
    return context, sources_list

# ====================== SIMPLIFIED LLM CALL ======================
def call_llm_simple(prompt: str):
    """
    SIMPLE LLM CALL:
    - More tokens for complete answers
    - Lower temperature for accuracy
    - Clear instructions for markdown formatting
    Returns: (answer, usage_dict) where usage_dict contains token counts
    """
    payload = {
        "messages": [
            {
                "role": "system",
                "content": """You are an expert AI assistant. Provide clear, complete, and well-structured answers using proper markdown formatting.

CRITICAL FORMATTING RULES:
1. Use **bold** for emphasis and important terms
2. Use bullet points (- or *) for lists
3. Use numbered lists (1. 2. 3.) for sequential steps
4. Use headers (## or ###) for sections
5. If you see CSV/tabular data, ALWAYS format it as markdown tables:
   | Column 1 | Column 2 | Column 3 |
   |----------|----------|----------|
   | Data 1   | Data 2   | Data 3   |
6. Use `code` formatting for technical terms, file names, or commands
7. Use > blockquotes for important notes or warnings
8. Add line breaks between sections for readability
9. For links, use [Link Text](URL) format
10. Be thorough - don't summarize unless asked

IMPORTANT:
- Use ALL the data provided to give COMPLETE answers
- Include all relevant details from the sources
- Format your response so it's easy to read and visually appealing
- Your response is directly shown to the user, so be careful about formatting"""
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": 3000,  # MORE tokens for longer answers
        "temperature": 0.3,  # Lower for more accurate answers
        "top_p": 0.95
    }
    
    try:
        print("🤖 Calling LLM...")
        response = requests.post(llm_url, headers=llm_headers, json=payload, timeout=120)
        
        if response.status_code == 200:
            result = response.json()
            answer = result['choices'][0]['message']['content']
            
            # Extract usage metadata (exact token counts from Databricks)
            usage = result.get('usage', {})
            usage_dict = {
                'prompt_tokens': usage.get('prompt_tokens', 0),
                'completion_tokens': usage.get('completion_tokens', 0),
                'total_tokens': usage.get('total_tokens', 0),
                'reasoning_tokens': usage.get('reasoning_tokens', 0)  # For reasoning models
            }
            
            print(f"✅ Answer: {len(answer)} chars")
            print(f"📊 Tokens: {usage_dict['prompt_tokens']} in / {usage_dict['completion_tokens']} out / {usage_dict['total_tokens']} total")
            
            return answer, usage_dict
        else:
            error_msg = f"LLM Error: {response.status_code}"
            return error_msg, {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0, 'reasoning_tokens': 0}
            
    except Exception as e:
        print(f"❌ LLM error: {e}")
        error_msg = f"Error: {str(e)}"
        return error_msg, {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0, 'reasoning_tokens': 0}

# ====================== MAIN SIMPLIFIED RAG ======================
def answer_with_intelligence(question: str, session_id: str):
    """
    SUPER SIMPLE FLOW:
    1. Search → Get 20 chunks
    2. Build context → Combine all chunks
    3. Add conversation history
    4. Call LLM → Get complete answer
    5. Store in memory
    """
    
    print(f"\n{'='*80}")
    print(f"Question: {question}")
    print(f"Session: {session_id}")
    
    # STEP 1: Search for chunks
    chunks = simple_search(question, top_k=20)
    
    if not chunks:
        # Track this as a failed request (no data found)
        observability.track_request(
            model=LLM_ENDPOINT,
            input_tokens=len(question) // 4,  # Estimate
            output_tokens=0,
            latency_ms=0,
            success=False,
            error="No relevant chunks found in knowledge base",
            user_id="web_user",
            session_id=session_id
        )
        print(f"[Observability] Tracked 'no chunks' request. Total: {len(observability.requests)}")
        
        return {
            "answer": "I couldn't find relevant information in the knowledge base. Could you rephrase your question?",
            "sources": [],
            "has_tables": False,
            "num_sources": 0,
            "table_count": 0,
            "doc_count": 0
        }
    
    # STEP 2: Build context from ALL chunks
    context, sources = build_simple_context(chunks)
    
    # STEP 3: Get conversation history
    history_context = memory.get_context(session_id)
    
    # STEP 4: Create prompt with enhanced formatting instructions
    user_prompt = f"""
{history_context}

AVAILABLE DATA FROM SOURCES:
{context}

USER QUESTION: {question}

INSTRUCTIONS FOR YOUR RESPONSE:
1. Read ALL the data carefully from the sources above
2. Provide a COMPLETE, well-formatted answer using proper markdown:
   - Use **bold** for important terms
   - Use bullet points (- or *) for lists
   - Use numbered lists for steps
   - Use headers (## or ###) for sections
   - Format tables as markdown tables with | separators
   - Use `code` formatting for technical terms
3. Be detailed and thorough - include all relevant information
4. If links are present in the data, provide them using [text](url) format
5. For community board questions, you MUST provide links to the user
6. Cite which sources you used (mention file names)
7. Your response is directly shown to the user - make it visually appealing and easy to read

YOUR DETAILED, WELL-FORMATTED ANSWER:"""

    # STEP 5: Get answer (with timing for observability)
    import time
    start_time = time.time()
    answer, usage = call_llm_simple(user_prompt)
    latency_ms = (time.time() - start_time) * 1000
    
    # Check if answer is an error
    is_error = answer.startswith("Error:") or answer.startswith("LLM Error:")
    
    # STEP 6: Store in memory (only if successful)
    if not is_error:
        memory.add_turn(session_id, question, answer)
    
    # Track for observability (using EXACT token counts from Databricks response)
    input_tokens = usage.get('prompt_tokens', 0)
    output_tokens = usage.get('completion_tokens', 0)
    
    # If no usage data, fallback to estimation
    if input_tokens == 0 and output_tokens == 0:
        input_tokens = len(user_prompt) // 4
        output_tokens = len(answer) // 4 if not is_error else 0
        if not is_error:
            print("⚠️ No usage metadata in response, using estimation")
    
    print(f"[Observability] Tracking request: success={not is_error}, tokens={input_tokens}/{output_tokens}, latency={latency_ms:.2f}ms")
    observability.track_request(
        model=LLM_ENDPOINT,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
        success=not is_error,
        error=answer if is_error else None,
        user_id="web_user",
        session_id=session_id
    )
    print(f"[Observability] Total tracked requests: {len(observability.requests)}")
    
    print(f"✅ Answer complete: {len(answer)} chars, {len(sources)} sources")
    print(f"{'='*80}\n")
    
    return {
        "answer": answer,
        "sources": sources,
        "has_tables": False,
        "num_sources": len(sources),
        "table_count": 0,
        "doc_count": len(sources)
    }

# ====================== FLASK APP (SERVES REACT BUILD) ======================
app = Flask(__name__, static_folder='dist', static_url_path='')
app.secret_key = os.urandom(32)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = 3600

# Path to the built React app
DIST_DIR = Path(__file__).parent / 'dist'

# Verify dist folder exists on startup
if not DIST_DIR.exists():
    print(f"⚠️ WARNING: dist folder not found at {DIST_DIR}")
    print(f"   Current directory: {Path(__file__).parent}")
    print(f"   Please ensure the dist/ folder is uploaded to Databricks")
else:
    print(f"✅ dist folder found at {DIST_DIR}")
    # List some files for verification
    assets_dir = DIST_DIR / 'assets'
    if assets_dir.exists():
        asset_files = list(assets_dir.glob('*'))[:5]
        print(f"   Found {len(list(assets_dir.glob('*')))} files in assets/")
        if asset_files:
            print(f"   Sample files: {[f.name for f in asset_files]}")

# ====================== STATIC FILE SERVING (REACT APP) ======================
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    """Serve React app - all routes go to index.html for SPA routing"""
    # Handle root path
    if not path or path == '/':
        return send_from_directory(DIST_DIR, 'index.html')
    
    # Normalize path (handle Windows/Unix separators)
    normalized_path = path.replace('\\', '/').lstrip('/')
    file_path = DIST_DIR / normalized_path
    
    # Debug logging (can remove in production)
    print(f"[Static] Requested: {path} -> {normalized_path}")
    print(f"[Static] Full path: {file_path}")
    print(f"[Static] Exists: {file_path.exists()}, Is file: {file_path.is_file() if file_path.exists() else False}")
    
    # Check if file exists and is a file (not directory)
    if file_path.exists() and file_path.is_file():
        try:
            # Try send_from_directory first (preferred method)
            return send_from_directory(str(DIST_DIR), normalized_path)
        except Exception as e:
            print(f"[Static] send_from_directory failed, trying send_file: {e}")
            try:
                # Fallback to send_file with explicit path
                return send_file(str(file_path))
            except Exception as e2:
                print(f"[Static] send_file also failed: {e2}")
                # Fall through to serve index.html
    
    # File doesn't exist or error occurred, serve index.html for SPA routing
    return send_from_directory(DIST_DIR, 'index.html')

# ====================== API ROUTES ======================
@app.route('/api/ask', methods=['POST'])
def ask():
    """Main chat endpoint - matches React app expectations"""
    try:
        data = request.get_json()
        question = data.get('question', '').strip()
        user_id = data.get('user_id', 'web_user')
        session_id = data.get('session_id', session.get('session_id', os.urandom(16).hex()))
        
        if not question:
            return jsonify({"error": "No question provided"}), 400
        
        session['session_id'] = session_id
        
        result = answer_with_intelligence(question, session_id)
        
        # Transform response to match React app format
        formatted_sources = []
        for src in result.get('sources', []):
            formatted_sources.append({
                'name': src.get('filename', 'Unknown'),
                'filename': src.get('filename', 'Unknown'),
                'path': src.get('path', ''),
                'type': src.get('type', 'document'),
                'is_table': src.get('is_table', False)
            })
        
        return jsonify({
            "answer": result.get('answer', ''),
            "session_id": session_id,
            "sources": formatted_sources,
            "citations": []  # Add if needed
        })
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        
        # Track failed request in observability
        import time
        observability.track_request(
            model=LLM_ENDPOINT,
            input_tokens=len(data.get('question', '')) // 4 if data else 0,  # Estimate
            output_tokens=0,
            latency_ms=0,
            success=False,
            error=str(e),
            user_id=data.get('user_id', 'web_user') if data else 'web_user',
            session_id=session.get('session_id', 'unknown')
        )
        print(f"[Observability] Tracked failed request. Total: {len(observability.requests)}")
        
        return jsonify({"error": str(e)}), 500

@app.route('/api/clear', methods=['POST'])
def clear():
    """Clear conversation history"""
    try:
        session_id = session.get('session_id')
        if session_id:
            memory.clear(session_id)
        session.clear()
        return jsonify({"status": "cleared"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "vector_search": vs_index is not None,
        "llm": LLM_ENDPOINT,
        "sessions": len(memory.conversations)
    })

@app.route('/api/observability/stats', methods=['GET'])
def observability_stats():
    """Observability stats endpoint - returns comprehensive statistics"""
    stats = observability.get_stats()
    print(f"[Observability] Stats request - Total requests: {stats['summary']['total_requests']}")
    print(f"[Observability] Total cost: ${stats['summary']['total_cost_usd']}, Input: ${stats['summary']['input_cost_usd']}, Output: ${stats['summary']['output_cost_usd']}")
    print(f"[Observability] Total tokens: {stats['summary']['total_tokens']} (in: {stats['summary']['total_tokens_input']}, out: {stats['summary']['total_tokens_output']})")
    return jsonify(stats)

@app.route('/api/observability/recent', methods=['GET'])
def observability_recent():
    """Recent requests endpoint"""
    limit = request.args.get('limit', 50, type=int)
    stats = observability.get_stats()
    recent = stats.get("recent_requests", [])[-limit:]
    return jsonify(recent)

@app.route('/api/observability/reset', methods=['POST'])
def observability_reset():
    """Reset observability statistics"""
    observability.reset()
    return jsonify({"status": "reset", "message": "Observability statistics reset successfully"})

@app.route('/api/document-proxy', methods=['GET'])
def document_proxy():
    """Proxy endpoint for documents (optional - can be implemented if needed)"""
    url_param = request.args.get('url')
    if not url_param:
        return jsonify({"error": "Missing url parameter"}), 400
    # For now, return error - can be implemented to fetch from blob storage
    return jsonify({"error": "Document proxy not implemented"}), 501

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 Starting PowerBI Beacon Chatbot (SIMPLIFIED)")
    print("="*60)
    print(f"✨ Open: http://localhost:8000")
    print(f"📊 Optimized for CSV data retrieval")
    print(f"🎯 Getting MORE chunks (20 instead of 8)")
    print(f"💡 More tokens (3000) for complete answers")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=8000, debug=True, threaded=True)
