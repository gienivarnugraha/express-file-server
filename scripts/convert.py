import os
import io
import sys
import subprocess # Needed to run external commands like 'pip install'
import pathlib
import pymupdf.layout
from openai import OpenAI, APIError as OpenAIAPIError
from markitdown import MarkItDown 
import pymupdf4llm



def clean_markdown_text(md_text, dir_name):
    """
    Removes common duplicate lines and unnecessary blank lines.
    """
    remove_double_lines = md_text.replace('\n\n','\n')

    dir_name_new = dir_name.split("/")[-1]

    lines = remove_double_lines.split('\n')

    processed_lines = []

    # We will only keep the first occurrence of similar lines
    if not lines:
        return ""

    print(f"Cleaning... '{len(lines)} strings'.")
    # Iterate through the rest of the lines
    for i in range(1, len(lines)):
        current_line = lines[i].strip()

        # If the line is empty
        if not current_line:
            continue

        # If the line has exact duplicate
        elif current_line in processed_lines:
            continue

        # If the line has image path
        elif re.search(r'!\[(.*?)\]', current_line):
            processed_lines.append(current_line.replace(dir_name, f"./{dir_name_new}"))

        # add to list
        else:
            processed_lines.append(current_line)

    # Join all lines and collapse multiple empty lines into a single one
    temp_text = '\n'.join(processed_lines)
    final_text = re.sub(r'\n\s*\n+', '\n\n', temp_text).strip()

    return final_text

def run_conversion():
    # import pdf_to_markdown #https://github.com/InectGit/pdf-to-markdown
    # 1. Check for API Key (passed via environment variables from Node.js)
    
    if 'OPENAI_API_KEY' not in os.environ:
        sys.stderr.write("Error: OPENAI_API_KEY environment variable is not set.\n")
        sys.exit(1)

    if len(sys.argv) < 2:
        sys.stderr.write("Error: Filename argument is missing.\n")
        sys.stderr.write("Usage: python script_name.py <path/to/file.pdf>\n")
        sys.exit(1)

    inputfile = sys.argv[1] # \public\documents\filename\filename.pdf
    outputfile = sys.argv[2] #  \public\documents\filename\filename.md

    # Use pathlib.Path for robust, cross-platform path handling
    file_path = pathlib.Path(inputfile)

    # The directory containing the input file
    dirname = file_path.parent # e.g.,  \public\documents\filename\
    # The file extension (including the dot)
    extension = file_path.suffix # e.g., .pdf
    # The file name without the extension (the 'stem' is the name of the directory/file)
    file_dir_stem = file_path.stem # e.g., filename
    # The full file name (including the extension)
    file_name = file_path.name # e.g., filename.pdf

    md_text=""

    try:
        
        # with open(inputfile, 'rb') as f:
        #     pdf_bytes = f.read()

        if os.path.exists(outputfile):
            print(f"Skipping '{file_name}' - Markdown file already exists.")
            return

        print(f"Converting '{file_name}'...")

        os.makedirs(dirname/"images", exist_ok=True)

        if extension == '.pdf':
            md = pymupdf4llm.to_markdown(
                doc=inputfile, 
                write_images=True, 
                header=False,
                footer=False,
                image_path= dirname / "images",
                image_format='png',
                page_separators=True
                )
                
            # md_text = md.encode('cp437')
            md_text = md

        else:
            sys.stdout.write(f"Running conversion using microsoft markit down for {inputfile} to {outputfile}: \n")

            # with open(inputfile, 'rb') as f:
            #     file_bytes = f.read()

            # Create an in-memory binary file from the byte string
            # binary_stream = io.BytesIO(file_bytes)

            openai_client = OpenAI()

            md = MarkItDown(
                llm_client=openai_client, 
                llm_model='gpt-4o-mini',
            )

            result = md.convert(inputfile)

            md_text = result.text_content


        # cleaned_md_text = clean_markdown_text(md_text, dirname)

        # Write to the file in the new sub-directory
        with open(outputfile, 'w', encoding='utf-8') as f:
            # f.write(cleaned_md_text)
            f.write(md_text)

            
        sys.stdout.write("Conversion successful.")
        sys.exit(0)

    except OpenAIAPIError as e:
        sys.stderr.write(f"OpenAI API Error: {e.status_code} - {e.response.json().get('error', {}).get('message', 'Unknown API Error')}\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"Conversion error: {e}\n")
        sys.exit(1)

if __name__ == "__main__":
    run_conversion()