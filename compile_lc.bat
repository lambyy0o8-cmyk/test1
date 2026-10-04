@echo off
set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
%"%" /nologo /target:winexe /out:test_lc.exe /reference:System.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Core.dll decompiled\lc.decompiled.cs 2> compile_errors.txt
type compile_errors.txt
