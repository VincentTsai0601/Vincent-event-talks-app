import urllib.request
import urllib.error
import json
import subprocess
import getpass
import sys
import os

REPO_NAME = "Vincent-event-talks-app"
USERNAME = "VincentTsai0601"

def create_github_repo(token):
    url = "https://api.github.com/user/repos"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Python-urllib"
    }
    data = {
        "name": REPO_NAME,
        "private": False,
        "description": "A premium, interactive Google Cloud BigQuery Release Notes dashboard built with Flask, HTML, CSS, and JS."
    }
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode('utf-8'), 
        headers=headers,
        method="POST"
    )
    
    try:
        print(f"Attempting to create GitHub repository '{REPO_NAME}'...")
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            print(f"Successfully created public repository on GitHub: {res_data.get('html_url')}")
            return True
    except urllib.error.HTTPError as e:
        if e.code == 422:
            print(f"Repository '{REPO_NAME}' might already exist on your account. Proceeding to push...")
            return True
        else:
            print(f"Error creating repository (HTTP {e.code}): {e.reason}")
            try:
                err_body = e.read().decode('utf-8')
                print("GitHub API response:", err_body)
            except:
                pass
            return False
    except Exception as e:
        print("An error occurred during repo creation:", str(e))
        return False

def run_cmd(args):
    try:
        res = subprocess.run(args, capture_output=True, text=True, check=True)
        return True, res.stdout
    except subprocess.CalledProcessError as e:
        return False, e.stderr

def push_code(token):
    print("Setting up local Git remote configuration...")
    
    # Remove existing remote in case it is configured incorrectly
    run_cmd(["git", "remote", "remove", "origin"])
    
    # Add remote containing the token for authentication during push
    auth_url = f"https://{USERNAME}:{token}@github.com/{USERNAME}/{REPO_NAME}.git"
    success, err = run_cmd(["git", "remote", "add", "origin", auth_url])
    if not success:
        print("Failed to add Git remote:", err)
        return False
        
    print("Pushing files to main branch...")
    # Push to origin main
    success, output = run_cmd(["git", "push", "-u", "origin", "main"])
    if not success:
        print("\nFailed to push code to GitHub. Error details:")
        print(output)
        # Clean up in case of failure
        run_cmd(["git", "remote", "remove", "origin"])
        run_cmd(["git", "remote", "add", "origin", f"https://github.com/{USERNAME}/{REPO_NAME}.git"])
        return False
        
    print("\nGit push successful!")
    
    # Clean up the token from git configuration by resetting remote url to standard URL
    run_cmd(["git", "remote", "set-url", "origin", f"https://github.com/{USERNAME}/{REPO_NAME}.git"])
    print("Successfully secured your local configuration (removed token from Git origin URL).")
    print(f"Your repository is live at: https://github.com/{USERNAME}/{REPO_NAME}")
    return True

def main():
    print("=" * 60)
    print("           GITHUB CREATION & PUSH UTILITY")
    print("=" * 60)
    print("To publish this project, you need a GitHub Personal Access Token (PAT) with 'repo' scope.")
    print("If you do not have one, you can create it here:")
    print("https://github.com/settings/tokens (select 'repo' scope, click generate)\n")
    
    token = input("Enter your GitHub Personal Access Token (PAT): ").strip()
    if not token:
        print("Token cannot be empty. Exiting.")
        sys.exit(1)
        
    if create_github_repo(token):
        if push_code(token):
            print("\nAll done! You can close this script.")
        else:
            print("\nRepository created, but code push failed. You can push manually using Git.")
    else:
        print("\nProcess aborted because repository creation failed. Please check your token and scopes.")

if __name__ == "__main__":
    main()
