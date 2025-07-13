# Serena Usage Guide for National Niner Backend

## Code Navigation and Understanding

### Getting Code Overview
```bash
# Get overview of symbols in a module
get_symbols_overview(relative_path="src/modules/team")

# Get overview of entire src directory (use carefully - can be large)
get_symbols_overview(relative_path="src")
```

### Finding Specific Code
```bash
# Find a specific class or function
find_symbol(name_path="TeamService", relative_path="src/modules/team")

# Find methods within a class
find_symbol(name_path="TeamService", depth=1, relative_path="src/modules/team/team.service.ts")

# Find a specific method with body
find_symbol(name_path="TeamService/createTeam", include_body=True, relative_path="src/modules/team/team.service.ts")
```

### Pattern Searching
```bash
# Search for patterns across the codebase
search_for_pattern(pattern="@RequirePermissions", restrict_search_to_code_files=True)

# Search for database queries
search_for_pattern(pattern="findAll|create|update|destroy", paths_include_glob="src/modules/**/*.ts")

# Search for specific error handling
search_for_pattern(pattern="BadRequestException|ForbiddenException", context_lines_before=2, context_lines_after=2)
```

### Understanding Relationships
```bash
# Find all references to a class or method
find_referencing_symbols(name_path="TeamService", relative_path="src/modules/team/team.service.ts")

# Find all classes that extend or implement something
find_referencing_symbols(name_path="BaseEntity", relative_path="src/common/entities/base.entity.ts")
```

## Code Editing Best Practices

### Symbol-Based Editing (Preferred)
```bash
# Replace entire method body
replace_symbol_body(name_path="TeamService/createTeam", relative_path="src/modules/team/team.service.ts", body="...")

# Insert new method after existing one
insert_after_symbol(name_path="TeamService/createTeam", relative_path="src/modules/team/team.service.ts", body="...")

# Insert import at top of file
insert_before_symbol(name_path="TeamService", relative_path="src/modules/team/team.service.ts", body="import { ... } from '...';\n")
```

### Regex-Based Editing (For small changes)
```bash
# Small targeted changes within methods
replace_regex(relative_path="...", regex="old_pattern", repl="new_pattern")

# Use wildcards for larger sections
replace_regex(relative_path="...", regex="start_pattern.*?end_pattern", repl="new_content")
```

## Project-Specific Search Patterns

### Finding Guards and Decorators
```bash
search_for_pattern(pattern="@UseGuards|@RequirePermissions")
```

### Finding Multi-tenant Violations
```bash
search_for_pattern(pattern="findAll|findOne|create|update|destroy", context_lines_before=3, context_lines_after=3)
# Then manually check for company_id inclusion
```

### Finding Test Files
```bash
search_for_pattern(pattern="describe\\(", paths_include_glob="**/*.spec.ts")
```

### Finding Entity Definitions
```bash
search_for_pattern(pattern="@Table|@Column", paths_include_glob="src/modules/**/entities/*.ts")
```

## Memory Management
- Use `list_memories()` to see available project memories
- Use `read_memory(memory_file_name="...")` to access project-specific information
- Key memories: project_overview, suggested_commands, code_style_conventions, task_completion_checklist

## Tips for Efficient Usage
1. **Start with overview**: Always use `get_symbols_overview` before detailed exploration
2. **Use relative_path**: Restrict searches to specific modules when possible
3. **Leverage context**: Use context lines when searching for patterns
4. **Check references**: Use `find_referencing_symbols` to understand impact of changes
5. **Follow TDD**: Write tests first, then implement using symbol-based editing