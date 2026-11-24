typedef __WCHAR_TYPE__ WCHAR;
typedef unsigned long DWORD;
typedef long long INTPTR;
__declspec(dllimport) DWORD __stdcall GetModuleFileNameW(void *, WCHAR *, DWORD);
__declspec(dllimport) int __stdcall SetEnvironmentVariableW(const WCHAR *, const WCHAR *);
__declspec(dllimport) void __stdcall ExitProcess(unsigned int);
__declspec(dllimport) INTPTR __stdcall ShellExecuteW(void *, const WCHAR *, const WCHAR *, const WCHAR *, const WCHAR *, int);
__declspec(dllimport) int __stdcall MessageBoxW(void *, const WCHAR *, const WCHAR *, unsigned int);

#include "payload.h"
static WCHAR path[32768];

void mainCRTStartup(void) {
    DWORD length = GetModuleFileNameW(0, path, sizeof(path) / sizeof(path[0]));
    if (length && length < sizeof(path) / sizeof(path[0]) &&
        SetEnvironmentVariableW(L"ZRYSPOTY_SELF", path)) {
        if (ShellExecuteW(0, L"open", L"powershell.exe", PARAMETERS, 0, 0) > 32) ExitProcess(0);
    }
    MessageBoxW(0, L"Nie mozna uruchomic odtwarzacza ZRYSPOTY.", L"ZRYSPOTY", 16);
    ExitProcess(1);
}
