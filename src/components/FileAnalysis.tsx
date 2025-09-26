import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Upload, FileType, Calculator, Info } from 'lucide-react';
import { VolumeCalculator } from '@/utils/volumeCalculator';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

interface FileAnalysisProps {
  onVolumeCalculated: (volume: number) => void;
  onModelLoaded?: (geometry: THREE.BufferGeometry) => void;
}

interface FileInfo {
  name: string;
  size: number;
  volume: number;
  surfaceArea: number;
  triangles: number;
  vertices: number;
}

const FileAnalysis: React.FC<FileAnalysisProps> = ({ onVolumeCalculated, onModelLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      await processFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  };

  const processFile = async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const loader = new STLLoader();
          
          // Load STL geometry
          const geometry = loader.parse(arrayBuffer);
          
          // Calculate volume and surface area
          const volume = VolumeCalculator.calculateGeometryVolume(geometry);
          const surfaceArea = VolumeCalculator.calculateSurfaceArea(geometry);
          
          // Get geometry info
          const positions = geometry.getAttribute('position');
          const indices = geometry.getIndex();
          const triangles = indices ? indices.count / 3 : positions.count / 3;
          const vertices = positions.count;
          
          const info: FileInfo = {
            name: file.name,
            size: file.size,
            volume: Math.abs(volume) / 1000, // Convert to cm³
            surfaceArea: surfaceArea / 100, // Convert to cm²
            triangles: Math.floor(triangles),
            vertices: vertices,
          };
          
          setFileInfo(info);
          onVolumeCalculated(info.volume);
          onModelLoaded?.(geometry);
          
          resolve();
        } catch (err) {
          reject(new Error('Failed to parse STL file. Please ensure the file is a valid STL format.'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      if (file.name.toLowerCase().endsWith('.stl')) {
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Please select a valid STL file'));
      }
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileType className="w-5 h-5 text-primary" />
          STL File Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <Button
            onClick={handleFileSelect}
            disabled={isProcessing}
            variant="outline"
            size="lg"
            className="w-full h-20 border-dashed border-2 hover:border-primary/50 transition-colors"
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8" />
              <span>{isProcessing ? 'Processing...' : 'Upload STL File'}</span>
              <span className="text-xs text-muted-foreground">
                Click to select an STL file for automatic volume calculation
              </span>
            </div>
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".stl"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {fileInfo && (
          <div className="space-y-4">
            <Separator />
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">File name:</span>
                <p className="font-medium truncate">{fileInfo.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">File size:</span>
                <p className="font-medium">{formatFileSize(fileInfo.size)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Triangles:</span>
                <p className="font-medium">{fileInfo.triangles.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Vertices:</span>
                <p className="font-medium">{fileInfo.vertices.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Calculated Volume</span>
                </div>
                <Badge variant="outline" className="bg-primary/10 border-primary">
                  {fileInfo.volume.toFixed(2)} cm³
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Surface Area</span>
                <span className="text-sm font-medium">{fileInfo.surfaceArea.toFixed(2)} cm²</span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p>Volume calculated using tetrahedron decomposition method.</p>
                <p className="mt-1">Ensure your STL file represents a closed, watertight mesh for accurate results.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FileAnalysis;